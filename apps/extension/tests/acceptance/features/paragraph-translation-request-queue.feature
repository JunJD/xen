Feature: Paragraph translation request queue
  Background paragraph translations should enqueue together and respect queue policy.

  Scenario: Parallel paragraph translation misses
    Given three uncached paragraphs are requested together
    When paragraph translation previews are built
    Then provider execution is not strictly serial

  Scenario: Queue throttling policy
    Given queue throttling is configured with limited burst capacity
    When four translation requests are enqueued together
    Then execution respects the configured queue policy

  Scenario: Timeout retry policy
    Given retries are enabled for transient translation failures
    When a queued translation attempt times out once
    Then the queue retries within the configured policy
