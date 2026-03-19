Feature: First-paint annotation rendering is decoupled from paragraph translation

  Scenario: Annotation render completes before slow paragraph translation
    Given paragraph translation is enabled and paragraph translation is slow
    When a paragraph enters the viewport
    Then annotation and token rendering complete before translated paragraph text appears

  Scenario: Paragraph translation is patched in after first paint
    Given a paragraph has already rendered annotations
    And paragraph translation eventually succeeds
    When the paragraph translation patch step completes
    Then the translated paragraph text is inserted after the source paragraph

  Scenario: Token rendering is unchanged when paragraph translation is disabled
    Given paragraph translation is disabled
    When annotations render for a viewport paragraph
    Then token rendering behavior remains unchanged
