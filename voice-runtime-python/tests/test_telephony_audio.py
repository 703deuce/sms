from transovo_voice.session.telephony_audio import (
    build_telephony_room_options,
    telephony_noise_cancellation_enabled,
)


def test_telephony_noise_cancellation_default_enabled() -> None:
    assert telephony_noise_cancellation_enabled()


def test_build_telephony_room_options_with_nc() -> None:
    opts = build_telephony_room_options(delete_room_on_close=False)
    assert opts.delete_room_on_close is False
    assert opts.audio_input is not None
    assert opts.audio_input.noise_cancellation is not None
