Feature: Betwright Tennis Animation
  As a QA tester
  I want to verify Tennis navigation and live animations on Betwright
  So that users have correct navigation and engaging live event animations

  Scenario: Tennis page navigation and live animation validation
    Given I navigate to "https://www.betwright.com"
    Then I should land on the Betwright home page

    And a cookie consent popup should be displayed
    When I click the "Allow all" button
    Then the cookie consent popup should be dismissed

    When I view the left-hand navigation panel
    Then I should see the following sports listed:
      | American Football |
      | Baseball |
      | Basketball |
      | Boxing |
      | Cricket |
      | Football |
      | Tennis |

    When I click on "Tennis"
    Then I should be redirected to the Tennis home page

    When I navigate to the "In-Play" section from the site header
    And I return to the left-hand navigation panel
    And I click on "Tennis" again
    Then I should return to the Tennis home page successfully

    And I should see the Events header with the following options:
      | Anytime |
      | In-Play |
      | Today |
      | Tomorrow |
      | Weekend |

    When I navigate to the "Today" tab
    When I select the "Today" tab
    And I scroll through the list of available Tennis events
    And then test for animation

    If no Tennis events are available under the "Today" tab
    Then I should automatically move to the "Tomorrow" tab
    And I scroll through the list of available Tennis events

    When I open a Tennis event
    Then the event page should load successfully

    And a live animation should be displayed if available

    And I should be able to validate Tennis live animations
    for events under both the "Today" and "Tomorrow" tabs

    And I should confirm that the animation behavior matches
