import os
import unittest

from transovo_voice.clips_recording.config import livekit_credentials_for_recording, recording_livekit_target


class ClipsRecordingConfigTest(unittest.TestCase):
    def setUp(self) -> None:
        self._env = dict(os.environ)

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._env)

    def test_default_cloud(self) -> None:
        os.environ['LIVEKIT_URL'] = 'wss://sms-6w01zoya.livekit.cloud'
        os.environ['LIVEKIT_API_KEY'] = 'k'
        os.environ['LIVEKIT_API_SECRET'] = 's'
        self.assertEqual(recording_livekit_target(), 'cloud')
        url, key, secret = livekit_credentials_for_recording()
        self.assertEqual(url, 'wss://sms-6w01zoya.livekit.cloud')
        self.assertEqual(key, 'k')
        self.assertEqual(secret, 's')

    def test_self_hosted(self) -> None:
        os.environ['RECORDING_LIVEKIT_TARGET'] = 'self_hosted'
        os.environ['LIVEKIT_SELF_HOSTED_URL'] = 'https://voice.transovo.ai'
        os.environ['LIVEKIT_SELF_HOSTED_API_KEY'] = 'k2'
        os.environ['LIVEKIT_SELF_HOSTED_API_SECRET'] = 's2'
        url, _, _ = livekit_credentials_for_recording()
        self.assertEqual(url, 'wss://voice.transovo.ai')


if __name__ == '__main__':
    unittest.main()
