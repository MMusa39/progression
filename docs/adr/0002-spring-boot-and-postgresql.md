# 0002: Spring Boot and PostgreSQL for the backend

- **Status:** Accepted
- **Date:** 2026-10-16

## Context
The backend must be written in Java (project goal) and serve a REST API for
structured, relational workout data plus analytics such as personal records and
progression over time.

## Options considered
- **Framework:** Spring Boot vs. Quarkus vs. Micronaut. Spring Boot is the most widely used Java framework in industry, with mature security (OAuth2 resource server), data access, and testing support.
- **Database:** PostgreSQL vs. DynamoDB. The data is hierarchical and relational (workout → exercises → sets), and analytics need grouping, window functions, and ad-hoc queries. In DynamoDB, every one of those access patterns would have to be designed up front.

## Decision
Java 25 (the current LTS release), Spring Boot 4, Spring Data JPA, PostgreSQL 18,
Flyway for schema migrations, and Gradle (Kotlin DSL) as the build tool.

## Consequences
- The schema is explicit and versioned, and analytics are expressed in plain SQL.
- An always-on database costs more than serverless options when deployed (see ADR 0004).
- Modern Java features (records, pattern matching, virtual threads) are available.
