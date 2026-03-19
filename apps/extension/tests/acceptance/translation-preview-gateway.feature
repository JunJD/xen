Feature: Translation preview gateway
  Scenario: Cached paragraphs skip provider requests
    Given two paragraphs already have cached paragraph translations
    And one paragraph does not have a cached paragraph translation
    When translation previews are built
    Then only the uncached paragraph is sent to the translation provider

  Scenario: Preview order follows the input order
    Given multiple paragraphs are requested for translation previews
    When translation previews are returned
    Then the previews keep the same order as the input paragraphs

  Scenario: Gateway tests run without the full background bootstrap
    Given the translation preview gateway is created with test doubles
    When unit tests invoke the gateway directly
    Then the gateway can be verified without booting the background setup
