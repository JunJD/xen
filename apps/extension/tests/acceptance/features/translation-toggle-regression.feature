Feature: Translation toggle regression
  Translation preview should still request paragraph translations and expose loading state.

  Scenario: Enabling translation preview after annotation render
    Given an annotated paragraph exists without a paragraph translation
    When the user enables translation preview
    Then the paragraph enters loading state
    And a paragraph translation request is sent for that paragraph
    And the paragraph returns to done after the translation patch completes
