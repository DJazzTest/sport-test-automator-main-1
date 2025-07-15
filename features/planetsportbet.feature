Feature: In-play match stats check

  Scenario: Check swiper-slide match stats for any in-play match
    Given I navigate to "https://planetsportbet.com/"
    When I go to "https://planetsportbet.com/inplay~"
    And I click on any in-play match (tennis or cricket)
    Then I should see an element with class "swiper-slide match-stats-one swiper-slide-prev"
