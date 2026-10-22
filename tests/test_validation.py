"""Test hors ligne (sans clé API) du garde-fou anti-hallucination.

    python -m tests.test_validation
"""
from agents.schemas import Citation, Judgement
from agents.search import search_articles
from agents.validation import validate

returned = search_articles("vitesse maximale engin de déplacement personnel motorisé")
real = returned[0]

# 1 vraie citation + 1 citation inventée
j = Judgement(type="conflit", explanation="test", confidence=0.9, citations=[
    Citation(ref=real["ref"], excerpt="ne dépasse pas 25 km/h"),
    Citation(ref="Code de la route, art. R999-99 (inventé)", excerpt="..."),
])
out, rejected = validate(j, returned)
assert rejected == 1, rejected
assert out.type == "conflit" and len(out.citations) == 1
assert out.citations[0].url == real["url"] and out.citations[0].version_date == real["version_date"]

# Que des citations inventées : le finding devient "vide" et sa confiance baisse
j = Judgement(type="conflit", explanation="test", confidence=0.8,
              citations=[Citation(ref="Loi imaginaire, art. 1")])
out, rejected = validate(j, returned)
assert rejected == 1 and out.type == "vide" and out.confidence == 0.4 and not out.citations

# Extrait inventé sur une vraie référence : remplacé par le vrai texte
j = Judgement(type="doublon", explanation="test", confidence=0.7,
              citations=[Citation(ref=real["ref"], excerpt="phrase qui n'existe pas dans l'article")])
out, _ = validate(j, returned)
assert out.citations[0].excerpt in real["text"]

print("OK : garde-fou anti-hallucination")
