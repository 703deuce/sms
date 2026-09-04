export function AppointmentsHeroMockup() {
  return (
    <div className="appt-mockup">
      <div className="appt-mockup-glow" aria-hidden />
      <div className="appt-mockup-frame">
        <div className="appt-mockup-topbar">
          <div className="appt-mockup-dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <span>transovo.ai/appointments</span>
        </div>
        <div className="appt-mockup-body">
          <div className="appt-mockup-sidebar">
            <div className="appt-mockup-nav active">Overview</div>
            <div className="appt-mockup-nav">Calendar</div>
            <div className="appt-mockup-nav">Workflows</div>
            <div className="appt-mockup-nav">Booking</div>
            <div className="appt-mockup-nav">Payments</div>
          </div>
          <div className="appt-mockup-main">
            <div className="appt-mockup-stats">
              <div className="appt-mockup-stat">
                <div className="label">Today&apos;s appointments</div>
                <div className="value">18</div>
                <div className="delta">+3 vs last week</div>
              </div>
              <div className="appt-mockup-stat">
                <div className="label">Reminders sent</div>
                <div className="value">42</div>
                <div className="delta">98% delivered</div>
              </div>
              <div className="appt-mockup-stat">
                <div className="label">No-show rate</div>
                <div className="value">4.2%</div>
                <div className="delta">↓ 12% this month</div>
              </div>
            </div>
            <div className="appt-mockup-panels">
              <div className="appt-mockup-panel">
                <div className="appt-mockup-panel-h">Upcoming appointments</div>
                <div className="appt-mockup-row">
                  <div className="appt-mockup-avatar" />
                  <div>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>Sarah M. · Consultation</div>
                    <div style={{ color: "#94a3b8" }}>Today 2:00 PM</div>
                  </div>
                  <span className="appt-mockup-badge">Confirmed</span>
                </div>
                <div className="appt-mockup-row">
                  <div className="appt-mockup-avatar" />
                  <div>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>James R. · Haircut</div>
                    <div style={{ color: "#94a3b8" }}>Today 3:30 PM</div>
                  </div>
                  <span className="appt-mockup-badge pending">Reminder sent</span>
                </div>
                <div className="appt-mockup-row">
                  <div className="appt-mockup-avatar" />
                  <div>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>Lisa K. · Facial</div>
                    <div style={{ color: "#94a3b8" }}>Tomorrow 10:00 AM</div>
                  </div>
                  <span className="appt-mockup-badge paid">Deposit paid</span>
                </div>
              </div>
              <div className="appt-mockup-panel">
                <div className="appt-mockup-panel-h">Workflow activity</div>
                <div className="appt-mockup-row">
                  <span style={{ color: "#059669", fontWeight: 700 }}>✓</span>
                  <span>24h reminder sent to Sarah M.</span>
                </div>
                <div className="appt-mockup-row">
                  <span style={{ color: "#6366f1", fontWeight: 700 }}>✓</span>
                  <span>AI booked James R. for 3:30 PM</span>
                </div>
                <div className="appt-mockup-row">
                  <span style={{ color: "#d97706", fontWeight: 700 }}>→</span>
                  <span>Deposit collected — Lisa K.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
