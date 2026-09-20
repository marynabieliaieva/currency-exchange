package com.currencyexchange.orderentry;

import org.springframework.boot.test.context.SpringBootTest;

/**
 * Base class for tests that need a real MongoDB (and, for service/concurrency
 * tests, the full application context). Spring Boot auto-configures an
 * ephemeral Flapdoodle instance (no Docker, no locally-running MongoDB
 * required) whenever the embedded-mongo dependency is on the test classpath.
 */
@SpringBootTest
public abstract class IntegrationTestSupport {
}
