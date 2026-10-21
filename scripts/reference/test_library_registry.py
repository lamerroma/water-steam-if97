"""Behavioral coverage of recursive discovery and existing JSON access limits."""
from pathlib import Path
import json
import math
import runpy
import unittest
import datetime

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

    def test_old_handle_never_addresses_a_new_session_object(self):
        old_namespace = runpy.run_path(str(ROOT / 'src/python-library-bridge.py'))
        new_namespace = runpy.run_path(str(ROOT / 'src/python-library-bridge.py'))
        def invoke(namespace, method, payload):
            return json.loads(namespace['_thermocalc_library_json'](json.dumps(
                {'module': 'fluids', 'method': method, 'payload': payload})))
        old = invoke(old_namespace, 'call', {'target': 'fluids.geometry.TANK', 'kwargs': {'D': 1, 'L': 2}})['result']
        new = invoke(new_namespace, 'call', {'target': 'fluids.geometry.TANK', 'kwargs': {'D': 2, 'L': 2}})['result']
        self.assertNotEqual(old['handle'], new['handle'])
        self.assertEqual(new['scope'], 'worker-session')
        stale = invoke(new_namespace, 'get', {'handle': old['handle'], 'member': 'V_total'})
        self.assertFalse(stale['ok'])
        self.assertIn('stale', stale['message'])
        with self.assertRaisesRegex(KeyError, 'stale'):
            new_namespace['_library_decode']({'$object': old['handle']})

    def test_release_from_another_package_cannot_remove_the_object(self):
        made = self.request('fluids', 'call', {'target': 'fluids.geometry.TANK', 'kwargs': {'D': 1, 'L': 2}})
        handle = made['result']['handle']
        self.assertFalse(self.request('ht', 'release', {'handle': handle})['ok'])
        self.assertTrue(self.request('fluids', 'get', {'handle': handle, 'member': 'V_total'})['ok'])
        self.assertEqual(self.request('fluids', 'release', {'handle': handle})['result'], {'released': True})
        self.assertEqual(self.request('fluids', 'release', {'handle': handle})['result'], {'released': False})

    def test_datetime_tag_preserves_offset_microseconds_and_explicit_naive_time(self):
        decode = self.namespace['_library_decode']
        self.assertEqual(decode({'$datetime': '2018-01-01T00:00:00Z'}),
                         datetime.datetime(2018, 1, 1, tzinfo=datetime.timezone.utc))
        self.assertEqual(decode({'$datetime': '2018-01-01T02:00:00.123456+02:00'}).utcoffset(),
                         datetime.timedelta(hours=2))
        self.assertEqual(decode({'$datetime': '2018-01-01T02:00:00.123456+02:00'}).microsecond, 123456)
        self.assertIsNone(decode({'$datetime': '2018-01-01T00:00:00', '$naive': True}).tzinfo)
        self.assertEqual(decode('2018-01-01T00:00:00Z'), '2018-01-01T00:00:00Z')

    def test_datetime_tag_rejects_ambiguous_or_silently_lossy_values(self):
        bad = [
            {'$datetime': '2018-01-01T00:00:00'},
            {'$datetime': '2018-01-01T00:00:00Z', '$naive': True},
            {'$datetime': '2018-01-01T00:00:00', '$naive': False},
            {'$datetime': '2018-01-01T00:00:00', '$naive': 1},
            {'$datetime': '2018-01-01T00:00:00Z', 'extra': 1},
            {'$datetime': '2018-01-01T00:00:00.1234567Z'},
            {'$datetime': '2018-01-01T00:00:00-00:00'},
            {'$datetime': '2018-01-01T00:00:00+00:60'},
            {'$datetime': '2018-01-01T00:00:00+24:00'},
            {'$datetime': '2018-02-30T00:00:00Z'},
            {'$datetime': '2018-01-01T00:00:60Z'},
            {'$datetime': '2018-01-01'}, {'$datetime': 0}]
        for value in bad:
            with self.subTest(value=value), self.assertRaises((ValueError, TypeError)):
                self.namespace['_library_decode'](value)

    def test_datetime_calls_and_outputs_use_the_public_JSON_path(self):
        import fluids.atmosphere
        utc = {'$datetime': '2018-01-01T00:00:00Z'}
        offset = {'$datetime': '2018-01-01T02:00:00+02:00'}
        expected = fluids.atmosphere.solar_position(datetime.datetime(2018, 1, 1, tzinfo=datetime.timezone.utc), 50, 30)
        for moment in [utc, offset]:
            reply = self.request('fluids', 'call', {'target': 'fluids.atmosphere.solar_position', 'args': [moment, 50, 30]})
            self.assertTrue(reply['ok'], reply)
            self.assertEqual(reply['result'], expected)
        sunrise = self.request('fluids', 'call', {'target': 'fluids.atmosphere.sunrise_sunset', 'args': [utc, 50, 30]})
        self.assertFalse(sunrise['ok'], sunrise)
        self.assertEqual(sunrise['message'], 'ValueError: fromutc: dt.tzinfo is not self')
        self.assertIn('fluids-sunrise-fixed-offset', [i['code'] for i in sunrise['description']['knownIssues']])
        naive = self.request('fluids', 'call', {'target': 'fluids.atmosphere.sunrise_sunset',
            'args': [{'$datetime': '2018-01-01T00:00:00', '$naive': True}, 50, 30]})
        self.assertTrue(naive['ok'], naive)
        self.assertEqual(len(naive['result']), 3)
        self.assertTrue(all(v['kind'] == 'datetime' and v['timezone'] == 'naive' for v in naive['result']))
        plain = self.namespace['_library_encode'](datetime.datetime(2018, 1, 1))
        self.assertEqual(plain, {'kind': 'datetime', 'iso8601': '2018-01-01T00:00:00', 'timezone': 'naive'})


if __name__ == '__main__':
    unittest.main()
