"""Tests de cadrage, sans LLM, réseau externe ni connexion PostgreSQL."""
import importlib.util
import sys
import unittest
from datetime import date
from pathlib import Path
from types import ModuleType
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
from pydantic import ValidationError

from agent.analysis import AnalysisInput, AnalysisOptions, analysis_prompt, prepare_analysis, search_handlers
from backend.lexguard import app


class AnalysisTests(unittest.TestCase):
    def test_absent_options_preserve_original_query_and_prompt(self):
        text = "  Explique les données de santé ?\n"
        body = AnalysisInput(text=text)
        request = prepare_analysis(body.text, body.options)
        self.assertEqual(request.query, text)
        self.assertEqual(analysis_prompt(text, request, body.options), text)
        self.assertEqual(request.filters.domains, [])
        self.assertEqual(request.filters.source_languages, [])
        self.assertIsNone(request.filters.published_after)

    def test_explicit_defaults_are_equivalent_to_absent_options(self):
        self.assertEqual(prepare_analysis('Demande'), prepare_analysis('Demande', AnalysisOptions()))
        original = {'web_search': Mock()}
        self.assertIs(search_handlers(original, prepare_analysis('Demande'), AnalysisOptions()), original)

    def test_partial_options_keep_other_defaults(self):
        options = AnalysisOptions(domains=['santé'])
        request = prepare_analysis('Données médicales', options)
        self.assertEqual(request.filters.domains, ['santé'])
        self.assertIsNone(request.constraints.level)
        self.assertIsNone(request.filters.published_after)
        self.assertIn('Domaines : santé', request.query)

    def test_domain_level_combinations(self):
        for domain in ['informatique', 'santé', 'droit', 'finance', 'éducation', 'autre']:
            for level in ['débutant', 'intermédiaire', 'avancé', 'expert']:
                with self.subTest(domain=domain, level=level):
                    options = AnalysisOptions(domains=[domain], other_domain='Énergie' if domain == 'autre' else None, level=level)
                    request = prepare_analysis('Comprendre les obligations', options)
                    self.assertEqual(request.constraints.level, level)
                    self.assertIn(level, request.query)
                    self.assertEqual(request.filters.domains, ['Énergie' if domain == 'autre' else domain])

    def test_multiple_domains_and_other(self):
        options = AnalysisOptions(domains=['droit', 'santé', 'autre', 'droit'], other_domain='  Énergie ')
        self.assertEqual(prepare_analysis('Demande', options).filters.domains, ['droit', 'santé', 'Énergie'])

    def test_invalid_options(self):
        cases = [
            {'domains':['inconnu']}, {'domains':'droit'}, {'level':'professionnel'},
            {'result_type':'vidéo'}, {'period':'10y'}, {'source_language':'es'},
            {'domains':['autre']}, {'domains':['autre'], 'other_domain':' '},
            {'other_domain':'Énergie'}, {'include_keywords':['']},
            {'exclude_keywords':['x'*101]}, {'include_keywords':'rgpd'},
            {'include_keywords':['a\nb']}, {'include_keywords':['x']*21},
            {'include_keywords':[123]}, {'include_keywords':['RGPD'], 'exclude_keywords':[' rgpd ']},
            {'unexpected':True},
        ]
        for value in cases:
            with self.subTest(value=value), self.assertRaises(ValidationError):
                AnalysisOptions.model_validate(value)

    def test_keywords_trim_deduplicate_and_exclude(self):
        options = AnalysisOptions(include_keywords=[' RGPD ', 'rgpd'], exclude_keywords=['publicité'])
        request = prepare_analysis('La publicité et les données de santé', options)
        self.assertEqual(request.constraints.include_keywords, ['RGPD'])
        self.assertNotIn('publicité', request.keywords)
        self.assertIn('santé', request.keywords)
        self.assertIn('"RGPD"', request.query)
        self.assertIn('-"publicité"', request.query)

    def test_dates_and_leap_year(self):
        for period, expected in [('1y',date(2023,2,28)),('5y',date(2019,2,28)),('all',None)]:
            with self.subTest(period=period):
                result = prepare_analysis('Demande', AnalysisOptions(period=period), today=date(2024,2,29))
                self.assertEqual(result.filters.published_after, expected)

    def test_languages(self):
        for language, expected in [(None,[]),('fr',['fr']),('en',['en']),('both',['fr','en'])]:
            with self.subTest(language=language):
                self.assertEqual(prepare_analysis('Demande', AnalysisOptions(source_language=language)).filters.source_languages,expected)

    def test_structured_prompt_contains_options(self):
        options = AnalysisOptions(domains=['droit'], level='expert', result_type='étude')
        request = prepare_analysis('Ma demande', options)
        prompt = analysis_prompt('Ma demande', request, options)
        self.assertTrue(prompt.startswith('Ma demande'))
        self.assertIn(request.model_dump_json(), prompt)
        self.assertEqual(request.constraints.result_type, 'étude')

    def test_search_receives_constraints_without_changing_implementation(self):
        web, knowledge, profile = Mock(return_value=['result']), Mock(return_value=[]), Mock()
        original = {'web_search':web,'search_knowledge':knowledge,'get_startup_profile':profile}
        options = AnalysisOptions(domains=['santé'], level='débutant', exclude_keywords=['publicité'])
        request = prepare_analysis('Demande', options)
        handlers = search_handlers(original, request, options)
        self.assertEqual(handlers['web_search']('question précise'), ['result'])
        query = web.call_args.kwargs['query']
        self.assertTrue(query.startswith('question précise'))
        self.assertIn('santé', query)
        self.assertIn('débutant', query)
        self.assertIn('-"publicité"', query)
        handlers['search_knowledge']('données', scope='sector')
        self.assertEqual(knowledge.call_args.kwargs['scope'], 'sector')
        self.assertIs(handlers['get_startup_profile'], profile)
        self.assertIs(original['web_search'], web)

    def test_empty_request_is_rejected(self):
        for text in ['', '   ']:
            with self.subTest(text=text), self.assertRaises(ValidationError):
                AnalysisInput(text=text)


class AnalysisApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_no_options(self):
        response = self.client.post('/api/lexguard/analysis', json={'text':'Ma demande'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['query'], 'Ma demande')

    def test_partial_options(self):
        response = self.client.post('/api/lexguard/analysis', json={'text':'Ma demande','options':{'domains':['finance'],'level':'expert'}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['filters']['domains'], ['finance'])
        self.assertEqual(response.json()['constraints']['level'], 'expert')

    def test_invalid_options_return_422(self):
        for options in [{'level':'invalid'},{'domains':['autre']},{'period':'10y'},{'include_keywords':['x'],'exclude_keywords':['X']}]:
            with self.subTest(options=options):
                response=self.client.post('/api/lexguard/analysis', json={'text':'Ma demande','options':options})
                self.assertEqual(response.status_code,422)

    def test_serialized_date(self):
        response = self.client.post('/api/lexguard/analysis', json={'text':'Demande','options':{'period':'1y'}})
        self.assertRegex(response.json()['filters']['published_after'], r'^\d{4}-\d{2}-\d{2}$')


class ChatIntegrationTests(unittest.TestCase):
    def load_chat(self):
        # Seules les dépendances externes sont simulées ; le flux chat est réel.
        llm = ModuleType('agent.llm')
        llm.run_agent = Mock(return_value='Réponse sans source')
        tools = ModuleType('agent.tools')
        tools.Toolbox = Mock()
        box = tools.Toolbox.return_value
        box.seen = {}
        box.definitions.return_value = []
        box.handlers.return_value = {'web_search':Mock(return_value=[])}
        db = ModuleType('backend.db')
        db.get_startup = Mock(return_value={'id':'s1','name':'Exemple','sector':'Santé'})
        db.get_messages = Mock(return_value=[])
        db.add_message = Mock()
        spec = importlib.util.spec_from_file_location('chat_under_test', Path(__file__).resolve().parents[1]/'agent/chat.py')
        module = importlib.util.module_from_spec(spec)
        import backend
        with patch.dict(sys.modules, {'agent.llm':llm,'agent.tools':tools,'backend.db':db}), patch.object(backend, 'db', db, create=True):
            spec.loader.exec_module(module)
        return module, llm, box, db

    def test_chat_without_options_keeps_raw_prompt_and_handlers(self):
        module,llm,box,db = self.load_chat()
        module.chat('s1','Texte brut')
        self.assertEqual(llm.run_agent.call_args.args[1], 'Texte brut')
        self.assertIs(llm.run_agent.call_args.args[3], box.handlers.return_value)
        self.assertEqual(db.add_message.call_args_list[0].args, ('s1','user','Texte brut'))

    def test_chat_passes_options_to_search(self):
        module,llm,box,db = self.load_chat()
        module.chat('s1','Texte brut', options=AnalysisOptions(domains=['droit'],level='expert'))
        args = llm.run_agent.call_args.args
        self.assertIn('"level":"expert"', args[1])
        args[3]['web_search']('question ciblée')
        query = box.handlers.return_value['web_search'].call_args.kwargs['query']
        self.assertIn('Domaines : droit', query)
        self.assertIn('Niveau : expert', query)
        self.assertEqual(db.add_message.call_args_list[0].args, ('s1','user','Texte brut'))


if __name__ == '__main__':
    unittest.main()
