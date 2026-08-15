import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { assertTelnyxConfigured } from "@/lib/messaging/telnyx/config";

export type TelnyxReservedPhoneNumber = {
  id: string;
  phone_number: string;
  status: string;
  expired_at?: string;
  errors?: string;
};

export type TelnyxNumberReservation = {
  id: string;
  status: string;
  phone_numbers: TelnyxReservedPhoneNumber[];
  customer_reference?: string;
};

type TelnyxSingleResponse<T> = { data: T };

export async function createTelnyxNumberReservation(input: {
  phoneNumber: string;
  customerReference?: string;
}): Promise<{
  reservation: TelnyxNumberReservation | null;
  phoneStatus: TelnyxReservedPhoneNumber | null;
  error?: string;
}> {
  assertTelnyxConfigured();
  const res = await telnyxRequest<TelnyxSingleResponse<TelnyxNumberReservation>>(
    "/number_reservations",
    {
      method: "POST",
      body: {
        phone_numbers: [{ phone_number: input.phoneNumber }],
        customer_reference: input.customerReference,
      },
    },
  );

  const reservation = res.data;
  const phoneStatus =
    reservation.phone_numbers?.find((p) => p.phone_number === input.phoneNumber) ??
    reservation.phone_numbers?.[0] ??
    null;

  if (!phoneStatus) {
    return { reservation, phoneStatus: null, error: "No phone number in reservation response" };
  }

  if (phoneStatus.status === "failed") {
    return {
      reservation,
      phoneStatus,
      error: phoneStatus.errors || "Number could not be reserved",
    };
  }

  return { reservation, phoneStatus };
}

export async function extendTelnyxNumberReservation(reservationId: string): Promise<TelnyxNumberReservation> {
  assertTelnyxConfigured();
  const res = await telnyxRequest<TelnyxSingleResponse<TelnyxNumberReservation>>(
    `/number_reservations/${reservationId}/actions/extend`,
    { method: "POST", body: {} },
  );
  return res.data;
}

export async function getTelnyxNumberReservation(
  reservationId: string,
): Promise<TelnyxNumberReservation | null> {
  assertTelnyxConfigured();
  try {
    const res = await telnyxRequest<TelnyxSingleResponse<TelnyxNumberReservation>>(
      `/number_reservations/${reservationId}`,
    );
    return res.data;
  } catch {
    return null;
  }
}
