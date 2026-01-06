declare module "midtrans-client" {
  interface SnapConfig {
    isProduction: boolean;
    serverKey: string;
    clientKey?: string;
  }

  interface TransactionDetails {
    order_id: string;
    gross_amount: number;
  }

  interface CustomerDetails {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  }

  interface ItemDetails {
    id?: string;
    price: number;
    quantity: number;
    name: string;
  }

  interface SnapParameter {
    transaction_details: TransactionDetails;
    customer_details?: CustomerDetails;
    item_details?: ItemDetails[];
    credit_card?: {
      secure?: boolean;
    };
    callbacks?: {
      finish?: string;
    };
  }

  interface SnapTransaction {
    token: string;
    redirect_url: string;
  }

  class Snap {
    constructor(config: SnapConfig);
    createTransaction(parameter: SnapParameter): Promise<SnapTransaction>;
  }

  interface CoreApiConfig {
    isProduction: boolean;
    serverKey: string;
    clientKey?: string;
  }

  interface TransactionStatus {
    transaction_id: string;
    order_id: string;
    gross_amount: string;
    payment_type: string;
    transaction_status: string;
    fraud_status?: string;
    transaction_time: string;
    settlement_time?: string;
    status_code: string;
    status_message: string;
  }

  class CoreApi {
    constructor(config: CoreApiConfig);
    transaction: {
      status(orderId: string): Promise<TransactionStatus>;
      notification(notificationJson: object): Promise<TransactionStatus>;
    };
  }

  export { Snap, CoreApi };
  export default { Snap, CoreApi };
}
