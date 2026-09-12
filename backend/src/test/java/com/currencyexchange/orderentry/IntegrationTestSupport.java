package com.currencyexchange.orderentry;

import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;

/**
 * Base class for tests that need a real MongoDB. Spring Boot auto-configures
 * an ephemeral Flapdoodle instance (no Docker, no locally-running MongoDB
 * required) whenever the embedded-mongo dependency is on the test classpath.
 */
@DataMongoTest
public abstract class IntegrationTestSupport {
}
