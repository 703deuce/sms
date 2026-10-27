import os
import unittest

from transovo_voice.clips_recording.config import livekit_credentials_for_recording


class ClipsRecordingConfigTest(unittest.TestCase):
    def setUp(self) -> None:
        self._env = dict(os.environ)

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._env)

    def test_cloud_vars_only(self) -> None:
        os.environ['LIVEKIT_URL'] = 'wss://sms-6w01zoya.livekit.cloud'
        os.environ['LIVEKIT_API_KEY'] = 'k'
        os.environ['LIVEKIT_API_SECRET'] = 's'
        url, key, secret = livekit_credentials_for_recording()
        self.assertEqual(url, 'wss://sms-6w01zoya.livekit.cloud')
        self.assertEqual(key, 'k')
        self.assertEqual(secret, 's')

    def test_ignores_self_hosted_env(self) -> None:
        os.environ['LIVEKIT_URL'] = 'wss://sms-6w01zoya.livekit.cloud'
        os.environ['LIVEKIT_API_KEY'] = 'k'
        os.environ['LIVEKIT_API_SECRET'] = 's'
        os.environ['LIVEKIT_SELF_HOSTED_URL'] = 'wss://voice.transovo.ai'
        os.environ['LIVEKIT_SELF_HOSTED_API_KEY'] = 'wrong'
        os.environ['LIVEKIT_SELF_HOSTED_API_SECRET'] = 'wrong'
        url, key, _ = livekit_credentials_for_recording()
        self.assertEqual(url, 'wss://sms-6w01zoya.livekit.cloud')
        self.assertEqual(key, 'k')


if __name__ == '__main__':
    unittest.main()
