/** Re-export CRM secret helpers under integration-neutral names. */
export {
  encryptCrmSecret as encryptIntegrationSecret,
  decryptCrmSecret as decryptIntegrationSecret,
} from "@/lib/crm/secrets";
