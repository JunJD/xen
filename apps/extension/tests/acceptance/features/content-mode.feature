Feature: Content mode persistence
  The extension should keep a user-selected content mode across page activity.

  Scenario: Persisting an explicit content mode
    Given the content page starts in the default mode
    When the user switches pickup mode to "on"
    Then the active mode is cached globally
    And the mode is saved in local storage
    And the page dataset reflects "on"
