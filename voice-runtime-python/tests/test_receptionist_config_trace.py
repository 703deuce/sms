import unittest

from transovo_voice.observability.receptionist_config_trace import _booking_mode_from_capabilities


class ReceptionistConfigTraceTest(unittest.TestCase):
    def test_booking_disabled_without_capability(self) -> None:
        self.assertEqual(_booking_mode_from_capabilities([], []), "BOOKING_DISABLED")

    def test_send_link_tools(self) -> None:
        self.assertEqual(
            _booking_mode_from_capabilities(["book_appointments"], ["send_booking_link"]),
            "SEND_LINK",
        )


if __name__ == "__main__":
    unittest.main()
