Feature: In-flight deduplication for identical translation requests
  Scenario: Duplicate callers share the same provider request
    Given the same paragraph text is requested twice before the first translation completes
    When both callers await the translation result
    Then the translation provider is called only once

  Scenario: Duplicate callers receive the same translated result
    Given one in-flight translation request succeeds
    When duplicate callers resolve for the same translation hash
    Then both callers receive the same translated paragraph text

  Scenario: Duplicate callers share the same failure without stale state
    Given one in-flight translation request fails
    When duplicate callers resolve for the same translation hash
    Then both callers observe the same failure path
    And the stale in-flight entry is cleared for the next retry
