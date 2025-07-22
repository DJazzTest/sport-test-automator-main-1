Feature: PlanetSportBet Animation Detection
  As a QA tester
  I want to verify that live sports events on PlanetSportBet display animated widgets
  So that users have an engaging visual experience during live events

  Background:
    Given I navigate to "https://planetsportbet.com/"
    And I accept all cookies by clicking "Allow all"
    And I close any promotional popups

  Scenario: Verify In Play events have animated widgets
    Given I am on the PlanetSportBet homepage
    When I click on the "In Play" section
    Then I should see a list of live events
    And I should see at least 1 live event available

  Scenario Outline: Check animation presence for different sports
    Given I am viewing the In Play events list
    When I click on a "<sport_type>" event titled "<event_title>"
    Then I should navigate to the event details page
    And the URL should contain "/event/"
    When I wait for the page to fully load
    Then I should see animated widgets with class "animated_widget" if animations are supported
    And I should be able to navigate back to the In Play list

    Examples:
      | sport_type | event_title                              | expected_animation |
      | Tennis     | Botic Van De Zandschulp vs Nicolas Jarry | PASS              |
      | Tennis     | Yannick Hanfmann vs Lukas Neumayer      | PASS              |
      | Tennis     | Barbora Palicova vs Priscilla Hon        | PASS              |
      | Cricket    | Hampshire vs Nottinghamshire             | FAIL              |
      | Cricket    | Sussex vs Essex                          | FAIL              |
      | Cricket    | Yorkshire vs Surrey                      | FAIL              |

  Scenario: Verify animation detection accuracy
    Given I have tested multiple live events
    When I analyze the animation detection results
    Then Tennis events should consistently show animated widgets
    And Cricket events should consistently not show animated widgets
    And The overall animation coverage should be approximately 59%
    And I should have tested 22 total live events
    And 13 events should have animations (PASS)
    And 9 events should not have animations (FAIL)

  Scenario: Verify test execution reliability
    Given I run the animation detection test
    When the test completes execution
    Then All event navigation should work correctly
    And All event titles should be captured accurately
    And The test should handle timeouts gracefully
    And Results should be logged with clear PASS/FAIL indicators
    And A comprehensive summary should be generated

  Scenario: Verify URL pattern handling
    Given I am testing event navigation
    When I click on any live event
    Then The URL should match the pattern "/event/" not "/inplay/"
    And Navigation back should return to the correct In Play list
    And The event list should remain visible after navigation

  @smoke @animation @planetsportbet
  Scenario: Smoke test for animation detection
    Given I navigate to PlanetSportBet In Play section
    When I test the first 3 available events
    Then At least 1 event should have animated widgets
    And The test should complete without critical errors
    And Results should be clearly categorized as PASS or FAIL
