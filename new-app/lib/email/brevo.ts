export async function sendTransactionalEmail(_input: {
  to: string;
  subject: string;
  htmlContent?: string;
  textContent?: string;
}): Promise<void> {
  console.log("BREVO_STUB_SKIP", { to: _input.to, subject: _input.subject });
}
