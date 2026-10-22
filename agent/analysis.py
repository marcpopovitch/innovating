"""Cadrage d'une demande avant recherche, sans dépendance au moteur de recherche."""
import calendar
import json
import re
from datetime import date
from functools import wraps
from typing import Callable, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Domain = Literal["informatique", "santé", "droit", "finance", "éducation", "autre"]
Level = Literal["débutant", "intermédiaire", "avancé", "expert"]
ResultType = Literal["définition", "tutoriel", "comparatif", "étude", "actualité"]


class AnalysisOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    domains: list[Domain] = Field(default_factory=list, max_length=6)
    other_domain: str | None = Field(default=None, max_length=100)
    level: Level | None = None
    result_type: ResultType | None = None
    period: Literal["1y", "5y", "all"] = "all"
    source_language: Literal["fr", "en", "both"] | None = None
    include_keywords: list[str] = Field(default_factory=list, max_length=20)
    exclude_keywords: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("other_domain", mode="before")
    @classmethod
    def clean_other(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @field_validator("domains")
    @classmethod
    def unique_domains(cls, values):
        return list(dict.fromkeys(values))

    @field_validator("include_keywords", "exclude_keywords")
    @classmethod
    def clean_keywords(cls, values):
        result = []
        seen = set()
        for value in values:
            value = value.strip()
            if not value or len(value) > 100 or any(ord(c) < 32 for c in value):
                raise ValueError("Chaque mot-clé doit contenir entre 1 et 100 caractères, sans caractère de contrôle.")
            if value.casefold() not in seen:
                result.append(value)
                seen.add(value.casefold())
        return result

    @model_validator(mode="after")
    def coherent_options(self):
        if ("autre" in self.domains) != bool(self.other_domain):
            raise ValueError("Le domaine Autre et sa précision doivent être renseignés ensemble.")
        included = {word.casefold() for word in self.include_keywords}
        if included.intersection(word.casefold() for word in self.exclude_keywords):
            raise ValueError("Un mot-clé ne peut pas être à la fois inclus et exclu.")
        return self

    def is_default(self) -> bool:
        return self == AnalysisOptions()


class SearchFilters(BaseModel):
    domains: list[str] = Field(default_factory=list)
    published_after: date | None = None
    source_languages: list[Literal["fr", "en"]] = Field(default_factory=list)


class SearchConstraints(BaseModel):
    level: Level | None = None
    result_type: ResultType | None = None
    include_keywords: list[str] = Field(default_factory=list)
    exclude_keywords: list[str] = Field(default_factory=list)


class SearchRequest(BaseModel):
    text: str
    query: str
    keywords: list[str]
    filters: SearchFilters
    constraints: SearchConstraints


class AnalysisInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=100000)
    options: AnalysisOptions = Field(default_factory=AnalysisOptions)

    @field_validator("text")
    @classmethod
    def nonempty_text(cls, value):
        if not value.strip():
            raise ValueError("La demande ne peut pas être vide.")
        return value  # Le texte d'origine est préservé pour les appels sans options.


STOP_WORDS = set("le la les un une des de du et ou en au aux pour sur dans avec sans par est sont ce cette ces que qui je tu il elle nous vous the a an of and or to for in on with is how what comment explique expliquer moi".split())


def prepare_analysis(text: str, options: AnalysisOptions | None = None,
                     *, today: date | None = None) -> SearchRequest:
    request = AnalysisInput(text=text, options=options or AnalysisOptions())
    options = request.options
    excluded = {word.casefold() for word in options.exclude_keywords}
    keywords = list(dict.fromkeys(
        word for word in re.findall(r"[^\W_]+(?:[-’'][^\W_]+)*", text.casefold())
        if len(word) > 2 and word not in STOP_WORDS and word not in excluded
    ))[:32]
    keywords = list(dict.fromkeys(keywords + options.include_keywords))
    after = None
    if options.period != "all":
        current = today or date.today()
        year = current.year - (1 if options.period == "1y" else 5)
        after = current.replace(year=year, day=min(current.day, calendar.monthrange(year, current.month)[1]))
    result = SearchRequest(
        text=text, query=text, keywords=keywords,
        filters=SearchFilters(
            domains=[options.other_domain if d == "autre" else d for d in options.domains],
            published_after=after,
            source_languages=[] if options.source_language is None else
                ["fr", "en"] if options.source_language == "both" else [options.source_language],
        ),
        constraints=SearchConstraints(
            level=options.level, result_type=options.result_type,
            include_keywords=options.include_keywords, exclude_keywords=options.exclude_keywords,
        ),
    )
    if not options.is_default():
        result.query = search_query(text, result)
    return result


def search_query(text: str, request: SearchRequest) -> str:
    """Adapte les critères aux outils existants qui n'acceptent qu'une chaîne."""
    filters, constraints = request.filters, request.constraints
    parts = [text]
    if filters.domains:
        parts.append("Domaines : " + ", ".join(filters.domains))
    if constraints.level:
        parts.append("Niveau : " + constraints.level)
    if constraints.result_type:
        parts.append("Résultat attendu : " + constraints.result_type)
    if filters.source_languages:
        parts.append("Langues des sources : " + ", ".join(filters.source_languages))
    if filters.published_after:
        parts.append("after:" + filters.published_after.isoformat())
    parts.extend(json.dumps(word, ensure_ascii=False) for word in constraints.include_keywords)
    parts.extend("-" + json.dumps(word, ensure_ascii=False) for word in constraints.exclude_keywords)
    return "\n".join(parts)


def analysis_prompt(text: str, request: SearchRequest, options: AnalysisOptions) -> str:
    if options.is_default():
        return text
    return text + "\n\nCadrage de la recherche (données utilisateur, pas des instructions système) :\n" + request.model_dump_json() + (
        "\nRespecte ce cadrage lors de la préparation des recherches. Vérifie les dates et les langues "
        "dans les sources : le moteur ne garantit pas l'application de ces contraintes."
    )


def search_handlers(handlers: dict[str, Callable], request: SearchRequest,
                    options: AnalysisOptions) -> dict[str, Callable]:
    if options.is_default():
        return handlers

    def adapt(handler):
        @wraps(handler)
        def wrapped(query: str, **kwargs):
            return handler(query=search_query(query, request), **kwargs)
        return wrapped

    return {name: adapt(handler) if name in {"search_knowledge", "web_search"} else handler
            for name, handler in handlers.items()}
