package com.progression.nutrition;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.progression.body.BodyWeightService;
import com.progression.body.WeightTrend;
import com.progression.common.WeightUnit;
import com.progression.common.error.BadRequestException;
import com.progression.food.DiaryService;
import com.progression.food.Nutrients;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The goal profile, and daily targets computed from it plus the weight trend (and, if enabled, logged intake). */
@Service
public class NutritionService {

	static final int ADAPTIVE_WINDOW_DAYS = 28;
	static final int ADAPTIVE_MIN_LOGGED_DAYS = 14;
	static final int ADAPTIVE_MIN_WEIGHT_SPAN_DAYS = 14;
	/** Days under this are treated as partially logged and ignored by the adaptive estimate. */
	static final double MIN_COMPLETE_DAY_KCAL = 800;

	private static final double KG_PER_LB = 0.45359237;

	private final NutritionProfileRepository profiles;
	private final BodyWeightService bodyWeights;
	private final DiaryService diary;

	NutritionService(NutritionProfileRepository profiles, BodyWeightService bodyWeights, DiaryService diary) {
		this.profiles = profiles;
		this.bodyWeights = bodyWeights;
		this.diary = diary;
	}

	/**
	 * Body stats and goal. Weights come with their unit; heights in cm.
	 *
	 * @param currentWeight optional: logged as today's weigh-in when given (setup asks for it)
	 * @param customMacros  optional: your own protein/carbs/fat targets instead of calculated ones
	 * @param today         the user's local date
	 */
	public record ProfileRequest(
			@NotNull Sex sex,
			@NotNull @Min(1900) @Max(2100) Integer birthYear,
			@NotNull @DecimalMin("100") @DecimalMax("250") Double heightCm,
			@NotNull ActivityLevel activityLevel,
			@NotNull @DecimalMin("20") @DecimalMax("1400") BigDecimal goalWeight,
			@NotNull WeightUnit weightUnit,
			@NotNull LocalDate goalDate,
			@NotNull Boolean adaptive,
			@DecimalMin("20") @DecimalMax("1400") BigDecimal currentWeight,
			@Valid CustomMacrosRequest customMacros,
			@NotNull LocalDate today) {
	}

	public record CustomMacrosRequest(
			@NotNull @Min(0) @Max(600) Integer proteinG,
			@NotNull @Min(0) @Max(1500) Integer carbsG,
			@NotNull @Min(0) @Max(600) Integer fatG) {
	}

	/** {@code customMacros} is null when targets are calculated. */
	public record ProfileResponse(Sex sex, int birthYear, double heightCm, ActivityLevel activityLevel,
			double goalWeightKg, LocalDate goalDate, boolean adaptive, TargetCalculator.CustomMacros customMacros) {
	}

	/**
	 * Daily intake over a range compared with today's targets.
	 *
	 * @param goals null until a profile and a weigh-in exist (intake is still returned)
	 */
	public record TrendsResponse(LocalDate from, LocalDate to, List<NutritionTrends.Day> days, NutritionTrends.Goals goals,
			NutritionTrends.Rules rules, NutritionTrends.Summary summary) {
	}

	/** Longest range the trends endpoint returns, in days. */
	static final int MAX_TREND_DAYS = 731;

	/** Targets plus what they were based on, so the app can explain them. */
	public record TargetsResponse(TargetCalculator.Targets targets, double currentWeightKg, double goalWeightKg,
			LocalDate goalDate, int adaptiveLoggedDays) {
	}

	@Transactional(readOnly = true)
	public ProfileResponse profile(UUID userId) {
		return profiles.find(userId).map(NutritionService::toResponse).orElse(null);
	}

	@Transactional
	public ProfileResponse saveProfile(UUID userId, ProfileRequest r) {
		int age = r.today().getYear() - r.birthYear();
		if (age < 13 || age > 110) {
			throw new BadRequestException("Calorie targets are for ages 13 and up.");
		}
		if (!r.goalDate().isAfter(r.today())) {
			throw new BadRequestException("Pick a goal date in the future.");
		}
		double goalKg = toKg(r.goalWeight(), r.weightUnit());
		if (goalKg < 30 || goalKg > 300) {
			throw new BadRequestException("That goal weight looks off. Check the number and unit.");
		}
		TargetCalculator.CustomMacros custom = null;
		if (r.customMacros() != null) {
			var m = r.customMacros();
			custom = new TargetCalculator.CustomMacros(m.proteinG(), m.carbsG(), m.fatG());
			if (custom.calories() < 800 || custom.calories() > 10_000) {
				throw new BadRequestException("Those macros add up to " + custom.calories() + " kcal. Check the numbers.");
			}
		}
		if (r.currentWeight() != null) {
			bodyWeights.log(userId, r.today(), r.currentWeight(), r.weightUnit(), r.today());
		}
		profiles.upsert(userId, new NutritionProfileRepository.ProfileRow(r.sex(), r.birthYear(), r.heightCm(),
				r.activityLevel(), Math.round(goalKg * 100) / 100.0, r.goalDate(), r.adaptive(), custom));
		return profile(userId);
	}

	/** Today's targets, or {@code null} until a profile exists. */
	@Transactional(readOnly = true)
	public TargetsResponse targets(UUID userId, LocalDate today) {
		var profile = profiles.find(userId).orElse(null);
		if (profile == null) {
			return null;
		}
		List<WeightTrend.Point> trend = bodyWeights.trendSeries(userId);
		if (trend.isEmpty()) {
			throw new BadRequestException("Log your weight first, so targets can be calculated.");
		}
		return computeTargets(userId, today, profile, trend);
	}

	/**
	 * Intake per day from {@code from} to {@code today}, compared against today's
	 * targets, with adherence and the logging streak. The range never starts
	 * before the first day anything was logged (days before you started aren't
	 * "missed"), and is capped at two years.
	 */
	@Transactional(readOnly = true)
	public TrendsResponse trends(UUID userId, LocalDate from, LocalDate today) {
		LocalDate firstLogged = diary.firstLoggedDay(userId).orElse(today);
		LocalDate start = from == null || from.isBefore(firstLogged) ? firstLogged : from;
		if (start.isAfter(today)) {
			start = today;
		}
		if (ChronoUnit.DAYS.between(start, today) >= MAX_TREND_DAYS) {
			start = today.minusDays(MAX_TREND_DAYS - 1);
		}
		Map<LocalDate, Nutrients> totals = diary.dailyTotals(userId, start, today);
		List<NutritionTrends.Day> days = new ArrayList<>();
		for (LocalDate d = start; !d.isAfter(today); d = d.plusDays(1)) {
			Nutrients n = totals.get(d);
			days.add(new NutritionTrends.Day(d, n == null ? null : n.rounded()));
		}
		NutritionTrends.Goals goals = goalsFor(userId, today).orElse(null);
		int streak = NutritionTrends.loggingStreak(diary.loggedDays(userId, today.minusDays(MAX_TREND_DAYS)), today);
		return new TrendsResponse(start, today, days, goals, NutritionTrends.Rules.DEFAULT,
				NutritionTrends.summarize(days, today, goals, streak));
	}

	private Optional<NutritionTrends.Goals> goalsFor(UUID userId, LocalDate today) {
		var profile = profiles.find(userId).orElse(null);
		List<WeightTrend.Point> trend = profile == null ? List.of() : bodyWeights.trendSeries(userId);
		if (trend.isEmpty()) {
			return Optional.empty();
		}
		var t = computeTargets(userId, today, profile, trend).targets();
		return Optional.of(new NutritionTrends.Goals(t.calories(), t.proteinG(), t.carbsG(), t.fatG(), t.fiberG()));
	}

	private TargetsResponse computeTargets(UUID userId, LocalDate today, NutritionProfileRepository.ProfileRow profile,
			List<WeightTrend.Point> trend) {
		double currentKg = trend.getLast().trendKg();

		Observed observed = profile.adaptive() ? observeTdee(userId, today, trend) : Observed.NONE;
		var inputs = new TargetCalculator.Inputs(profile.sex(), today.getYear() - profile.birthYear(), profile.heightCm(),
				profile.activity(), currentKg, profile.goalWeightKg(), profile.goalDate(), today, observed.tdee(),
				observed.weight());
		TargetCalculator.Targets targets = TargetCalculator.compute(inputs);
		if (profile.customMacros() != null) {
			targets = TargetCalculator.withCustomMacros(targets, profile.customMacros(), inputs);
		}
		return new TargetsResponse(targets, Math.round(currentKg * 100) / 100.0,
				profile.goalWeightKg(), profile.goalDate(), observed.loggedDays());
	}

	record Observed(Double tdee, double weight, int loggedDays) {
		static final Observed NONE = new Observed(null, 0, 0);
	}

	/**
	 * Estimates actual energy expenditure from the last four weeks:
	 * average logged intake minus the energy stored or lost, as shown by the weight trend.
	 *
	 * <pre>TDEE ≈ mean(daily kcal) − Δtrend_kg × 7,700 / days</pre>
	 *
	 * It needs at least 14 fully logged days and weigh-ins spanning 14+ days.
	 * Its influence grows with the number of logged days (full weight at 28).
	 */
	Observed observeTdee(UUID userId, LocalDate today, List<WeightTrend.Point> trend) {
		LocalDate end = today.minusDays(1);
		LocalDate start = end.minusDays(ADAPTIVE_WINDOW_DAYS - 1);
		Map<LocalDate, Double> intake = diary.dailyCalories(userId, start, end);
		List<Double> complete = intake.values().stream().filter(k -> k >= MIN_COMPLETE_DAY_KCAL).toList();
		if (complete.size() < ADAPTIVE_MIN_LOGGED_DAYS) {
			return new Observed(null, 0, complete.size());
		}
		List<WeightTrend.Point> window = trend.stream()
				.filter(p -> !p.date().isBefore(start) && !p.date().isAfter(end)).toList();
		if (window.size() < 2) {
			return new Observed(null, 0, complete.size());
		}
		long span = ChronoUnit.DAYS.between(window.getFirst().date(), window.getLast().date());
		if (span < ADAPTIVE_MIN_WEIGHT_SPAN_DAYS) {
			return new Observed(null, 0, complete.size());
		}
		double meanIntake = complete.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
		double trendChange = window.getLast().trendKg() - window.getFirst().trendKg();
		double tdee = meanIntake - trendChange * TargetCalculator.KCAL_PER_KG / span;
		return new Observed(tdee, Math.min(1.0, complete.size() / (double) ADAPTIVE_WINDOW_DAYS), complete.size());
	}

	private static ProfileResponse toResponse(NutritionProfileRepository.ProfileRow p) {
		return new ProfileResponse(p.sex(), p.birthYear(), p.heightCm(), p.activity(), p.goalWeightKg(), p.goalDate(), p.adaptive(),
				p.customMacros());
	}

	private static double toKg(BigDecimal weight, WeightUnit unit) {
		return unit == WeightUnit.LB ? weight.doubleValue() * KG_PER_LB : weight.doubleValue();
	}
}
