from app.services.forum.trending import trending_score


def test_more_upvotes_scores_higher():
    assert trending_score(10, 0, 1.0) > trending_score(1, 0, 1.0)


def test_older_scores_lower():
    assert trending_score(10, 0, 1.0) > trending_score(10, 0, 100.0)


def test_zero_engagement_is_zero():
    assert trending_score(0, 0, 5.0) == 0.0


def test_comments_contribute():
    assert trending_score(0, 4, 1.0) > trending_score(0, 1, 1.0)
