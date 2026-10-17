package com.progression.nutrition;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.progression.body.BodyWeightService;
import com.progression.body.WeightTrend;
import com.progression.common.WeightUnit;
import com.progression.common.error.BadRequestException;
import com.progression.food.DiaryService;
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
			@NotNull LocalDate today) {
	}

	public record ProfileResponse(Sex sex, int birthYear, double heightCm, ActivityLevel activityLevel,
			double goalWeightKg, LocalDate goalDate, boolean adaptive) {
	}

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
		if (r.currentWeight() != null) {
			bodyWeights.log(userId, r.today(), r.currentWeight(), r.weightUnit(), r.today());
		}
		profiles.upsert(userId, new NutritionProfileRepository.ProfileRow(r.sex(), r.birthYear(), r.heightCm(),
				r.activityLevel(), Math.round(goalKg * 100) / 100.0, r.goalDate(), r.adaptive()));
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
		double currentKg = trend.getLast().trendKg();

		Observed observed = profile.adaptive() ? observeTdee(userId, today, trend) : Observed.NONE;
		var inputs = new TargetCalculator.Inputs(profile.sex(), today.getYear() - profile.birthYear(), profile.heightCm(),
				profile.activity(), currentKg, profile.goalWeightKg(), profile.goalDate(), today, observed.tdee(),
				observed.weight());
		return new TargetsResponse(TargetCalculator.compute(inputs), Math.round(currentKg * 100) / 100.0,
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
		return new ProfileResponse(p.sex(), p.birthYear(), p.heightCm(), p.activity(), p.goalWeightKg(), p.goalDate(), p.adaptive());
	}

	private static double toKg(BigDecimal weight, WeightUnit unit) {
		return unit == WeightUnit.LB ? weight.doubleValue() * KG_PER_LB : weight.doubleValue();
	}
}
