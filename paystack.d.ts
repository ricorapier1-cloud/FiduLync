declare module '@paystack/inline-js' {
	type PaystackTransaction = {
		id: number;
		reference: string;
		message: string;
	};

	export default class PaystackPop {
		newTransaction(options: {
			key: string;
			email: string;
			amount: number;
			currency?: string;
			planCode?: string;
			reference?: string;
			metadata?: Record<string, unknown>;
			onSuccess: (transaction: PaystackTransaction) => void;
			onCancel: () => void;
			onError: (error: { message: string }) => void;
		}): unknown;
	}
}
