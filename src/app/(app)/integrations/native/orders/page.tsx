import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NativeOrdersOpus } from "@/newui-transplant/connected/integrations/native-orders-opus";
import { OrdersClient } from "./orders-client";

export default function NativeOrdersPage() {
  if (isNewUiStage2Enabled()) {
    return <NativeOrdersOpus />;
  }
  return <OrdersClient />;
}
