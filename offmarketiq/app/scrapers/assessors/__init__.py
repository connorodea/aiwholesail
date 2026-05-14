"""
Assessor scrapers.

`AssessorRegistry` maps county FIPS → scraper class. Celery's
`scrape_county_assessor` task looks the class up here.
"""

from app.scrapers.assessors.socrata import SocrataGenericScraper

# fips -> scraper class. Populated as scrapers are added.
AssessorRegistry: dict[str, type] = {
    # "17031": CookAssessorScraper,         # Cook, IL (Socrata) — added in Phase 1
    # "06037": LAAssessorScraper,           # LA, CA (Socrata) — added in Phase 1
    # "04013": MaricopaAssessorScraper,     # Maricopa, AZ — added in Phase 1
    # "48201": HarrisAssessorScraper,       # Harris, TX — added in Phase 1
}

__all__ = ["AssessorRegistry", "SocrataGenericScraper"]
