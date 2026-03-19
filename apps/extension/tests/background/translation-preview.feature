Feature: Parallel translation preview building
  Scenario: Stable output order when misses finish out of order
    Given translation preview inputs A, B, and C
    And A, B, and C all miss the translation cache
    When paragraph B finishes before paragraph A
    Then the returned previews appear in A, B, C order

  Scenario: Cache hits do not wait behind misses
    Given translation preview inputs with a cache miss for A, a cache hit for B, and a cache miss for C
    When previews are built through the translation queue
    Then cached preview B does not wait unnecessarily behind misses
    And the returned previews still appear in A, B, C order

  Scenario: One paragraph failure falls back without disturbing others
    Given translation preview inputs A, B, and C
    And paragraph B translation fails
    When previews are returned
    Then previews A and C still succeed
    And paragraph B falls back to token-only preview data
    And the returned previews still appear in A, B, C order
