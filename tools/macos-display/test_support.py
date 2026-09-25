import contextlib
import unittest
from unittest.mock import patch, Mock
from support import NativeTools, NAME, serial_desktop


class DisplayFixtureTests(unittest.TestCase):
    def tools(self, observations):
        tools = NativeTools.__new__(NativeTools)
        import pathlib
        tools.build = pathlib.Path('/tmp/fixture-unit')
        tools.screen_probe = Mock(side_effect=observations)
        return tools

    def test_failure_still_terminates_and_restores(self):
        baseline = [dict(name='Physical', x=0, y=0, width=1440, height=900, scale=2)]
        virtual = dict(name=NAME, x=1440, y=0, width=1920, height=1080, scale=1)
        tools = self.tools([baseline, baseline + [virtual], baseline])
        with patch('support.subprocess.Popen') as process, patch('support.ready', return_value={}), patch('support.terminate') as terminate:
            with self.assertRaisesRegex(ValueError, 'consumer failure'):
                with tools.display(1920, 1080, 1):
                    raise ValueError('consumer failure')
            terminate.assert_called_once_with(process.return_value)
            self.assertEqual(tools.screen_probe.call_count, 3)

    def test_changed_physical_display_fails_instead_of_passing(self):
        baseline = [dict(name='Physical', x=0, y=0, width=1440, height=900, scale=2)]
        changed = [dict(baseline[0], width=1280), dict(name=NAME, x=1440, y=0, width=1920, height=1080, scale=1)]
        tools = self.tools([baseline, changed, changed, baseline])
        with patch('support.subprocess.Popen'), patch('support.ready', return_value={}), patch('support.terminate'):
            with self.assertRaisesRegex(RuntimeError, 'Existing display geometry changed'):
                with tools.display(1920, 1080, 1):
                    self.fail('unsafe geometry was accepted')

    def test_cross_consumer_lock_is_exclusive(self):
        with serial_desktop():
            with self.assertRaisesRegex(RuntimeError, 'Another native display test'):
                with serial_desktop():
                    self.fail('concurrent desktop test was accepted')

if __name__ == '__main__':
    unittest.main()
