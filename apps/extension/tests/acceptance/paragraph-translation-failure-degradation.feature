Feature: Paragraph translation failure degradation

  Scenario: Successful paragraphs still render when one translation request fails
    Given three annotated paragraphs are ready to render
    And one paragraph translation request fails while the other two succeed
    When preview and render processing completes
    Then the two successful paragraphs still show their paragraph translations
    And the failed paragraph does not block the rest of the render flow

  Scenario: Token-only rendering remains available for a failed paragraph translation
    Given a paragraph has annotations but no resolved paragraph translation override
    When the UI renders that paragraph
    Then token and annotation rendering still uses the source tokens
    And the paragraph can omit only the failed translation line

  Scenario: A later retry can recover after failure cleanup
    Given a paragraph translation attempt previously failed
    And the failed attempt left no usable paragraph translation override
    When a later retry succeeds for that paragraph
    Then the new translation override is applied normally
    And stale failure or inflight state does not block recovery
