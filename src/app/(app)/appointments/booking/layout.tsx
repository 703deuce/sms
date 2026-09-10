import { BookingPagesSubnav } from "@/components/appointments/booking-pages-subnav";

export default function AppointmentBookingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <div className="border-b border-[#ecedf2] bg-white px-6 pt-4">
        <BookingPagesSubnav />
      </div>
      {children}
    </>
  );
}
