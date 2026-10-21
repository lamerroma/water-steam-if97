"""Behavioral coverage of recursive discovery and existing JSON access limits."""
from pathlib import Path
import json
import math
import runpy
import unittest

ROOT = Path(__file__).resolve().parent.parent.parent


class LibraryRegistryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.namespace = runpy.run_path(str(ROOT / 'src/python-library-bridge.py'))
        cls.execute = staticmethod(cls.namespace['_thermocalc_library_json'])

    def request(self, package, method, payload):
        return json.loads(self.execute(json.dumps({'module': package, 'method': method, 'payload': payload})))

    def test_recursive_catalog_removes_repeated_paths_but_keeps_aliases(self):
        reply = self.request('fluids', 'catalog', {})
        self.assertTrue(reply['ok'])
        catalog = reply['result']
        paths = [entry['path'] for entry in catalog['entries']]
        self.assertEqual(len(paths), 2636)
        self.assertEqual(paths, sorted(set(paths)))
        self.assertIn('fluids.numerics.arrays.det', paths)
        self.assertIn('fluids.Reynolds', paths)
        self.assertIn('fluids.core.Reynolds', paths)
        self.assertEqual(catalog['publicSurface']['duplicatePathsRemoved'], 10)
        self.assertEqual({r['module'] for r in catalog['unavailableModules']},
                         {'fluids.numba', 'fluids.numba_vectorized', 'fluids.units'})

    def test_elementary_controls_use_the_public_json_call_path(self):
        controls = json.loads((ROOT / 'docs/library-registry/controls.json').read_text(encoding='utf-8'))
        for case in controls['cases']:
            with self.subTest(case=case['id']):
                reply = self.request(case['module'], 'call', {'target': case['target'], 'args': case['args']})
                self.assertTrue(reply['ok'], reply)
                if case.get('disposition') == 'known_upstream_discrepancy':
                    self.assertNotEqual(reply['result'], case['expected'])
                    self.assertEqual(reply['result'], case['observedUpstream'])
                    self.assertIn(case['issueCode'], [i['code'] for i in reply['description']['knownIssues']])
                else:
                    self.assertEqual(reply['result'], case['expected'])

    def test_nested_public_function_reference_and_private_rejection(self):
        function = self.namespace['_library_decode']({'$function': 'fluids.numerics.arrays.det'})
        self.assertEqual(function([[1, 2], [3, 4]]), -2)
        for target in ('fluids.numerics.arrays.__dict__', 'fluids.numerics.arrays._private', '__import__'):
            with self.subTest(target=target):
                self.assertFalse(self.request('fluids', 'get', {'target': target})['ok'])
        with self.assertRaises(ValueError):
            self.namespace['_library_decode']({'$function': 'os.system'})

    def test_object_access_is_owned_public_and_invalid_after_release(self):
        made = self.request('fluids', 'call', {'target': 'fluids.geometry.TANK', 'kwargs': {'D': 1, 'L': 2, 'horizontal': False}})
        self.assertTrue(made['ok'], made)
        handle = made['result']['handle']
        volume = self.request('fluids', 'get', {'handle': handle, 'member': 'V_total'})
        self.assertAlmostEqual(volume['result'], math.pi / 2)
        for member in ('__dict__', 'V_total.real'):
            self.assertFalse(self.request('fluids', 'get', {'handle': handle, 'member': member})['ok'])
        self.assertFalse(self.request('ht', 'get', {'handle': handle, 'member': 'V_total'})['ok'])
        self.assertTrue(self.request('fluids', 'release', {'handle': handle})['ok'])
        self.assertFalse(self.request('fluids', 'get', {'handle': handle, 'member': 'V_total'})['ok'])


if __name__ == '__main__':
    unittest.main()
