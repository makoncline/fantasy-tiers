"""Focused tests for experiment pairing and observed return boundaries."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


comparison = load('compare-experiments')
availability = load('evaluate-availability')


class ExperimentReportsTest(unittest.TestCase):
    def test_pairing_rejects_a_different_seed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            log = root / 'log.json'
            log.write_text(json.dumps({'schemaVersion': 2, 'league': {'rounds': 1}, 'decisions': [{}]}))
            before = root / 'before.json'
            after = root / 'after.json'
            for path, seed in [(before, 'first'), (after, 'different')]:
                path.write_text(json.dumps({'args': {}, 'runs': [{'seed': seed, 'slot': 4, 'decisionsPath': str(log)}]}))
            with self.assertRaisesRegex(ValueError, 'identical seeds'):
                comparison.compare(before, after)

    def test_survival_excludes_own_pick_and_includes_next_turn(self):
        def option(player, probability):
            return {'playerId': player, 'position': 'WR', 'comebackProbability': probability}
        log = {'decisions': [
            {'pickNo': 4, 'round': 1, 'selected': option('mine', .1), 'topOptions': [option('mine', .1), option('lost', .3), option('next', .8), option('unknown', None)]},
            {'pickNo': 21, 'round': 2},
        ]}
        artifact = {'summary': {'status': 'complete'}, 'sleeper': {'picks': [
            {'pick_no': 4, 'player_id': 'mine'}, {'pick_no': 20, 'player_id': 'lost'}, {'pick_no': 21, 'player_id': 'next'},
        ]}}
        result = list(availability.observations(log, artifact))
        self.assertEqual([(r['distance'], r['y']) for r in result], [(16, 0), (16, 1)])
        self.assertAlmostEqual(availability.score([(r['p'], r['y']) for r in result])['brier'], .065)

    def test_constant_paired_effect_has_no_sampling_uncertainty(self):
        self.assertEqual(comparison.paired_interval([3] * 12), {'mean': 3, 'bootstrap95': [3, 3]})

    def test_one_board_does_not_report_a_confidence_interval(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'predictions.json'
            path.write_text(json.dumps({'method': 'test', 'samples': 32, 'inputs': [{}], 'rows': [
                {'board': 'one', 'position': 'QB', 'distance': 6, 'observed': 1,
                 'current': .5, 'platform': .7, 'roster': .8},
            ]}))
            delta = availability.evaluate_prototype(path)['rosterVsCurrentBoardBootstrapBrierDelta']
            self.assertIsNone(delta['interval'])
            self.assertAlmostEqual(delta['meanDelta'], -.21)


if __name__ == '__main__':
    unittest.main()
