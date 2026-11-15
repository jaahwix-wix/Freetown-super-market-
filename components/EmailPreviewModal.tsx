'use client';

import React from 'react';
import { X, MailCheck, Printer } from 'lucide-react';
import type { EmailNotificationRecord } from '@/lib/types';

interface EmailPreviewModalProps {
  email: EmailNotificationRecord | null;
  htmlOverride?: string | null;
  canPrint?: boolean;
  onClose: () => void;
}

export function EmailPreviewModal({
  email,
  htmlOverride,
  canPrint = false,
  onClose,
}: EmailPreviewModalProps) {
  if (!email) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:static print:inset-auto print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-preview-title"
    >
      <div className="w-full max-w-2xl bg-white border border-[#DCE1DD] rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh] print-only-sheet">
        <div className="no-print px-6 py-4 border-b border-[#E3E7E4] flex items-center justify-between gap-4 bg-[#F8F9F8]">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#156145] flex items-center gap-1.5">
              <MailCheck className="w-4 h-4 shrink-0" />
              <span>
                {email.deliveryMode === 'smtp'
                  ? 'Delivered via SMTP'
                  : 'Automated Receipt Dispatched (Outbox Logged)'}
              </span>
            </p>
            <h2
              id="email-preview-title"
              className="font-display text-base font-semibold text-[#141715] truncate mt-0.5"
            >
              {email.subject}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canPrint && (
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-[#156145] hover:bg-[#114E37] text-white text-xs font-semibold rounded-md inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close email preview"
              className="p-2 rounded-md text-[#4F5852] hover:text-[#141715] hover:bg-[#EAECEB] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-3 border-b border-[#E3E7E4] text-xs text-[#4F5852] flex flex-wrap items-center gap-x-3 gap-y-1 bg-white font-mono">
          <span>To: {email.recipientEmail}</span>
          <span aria-hidden="true">·</span>
          <span>Order: {email.orderNumber}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate max-w-[260px]">ID: {email.messageId}</span>
        </div>

        <div className="p-6 overflow-y-auto bg-[#F8F9F8] flex-1 print:bg-white print:p-0 print:overflow-visible">
          {htmlOverride ? (
            <div
              className="bg-white border border-[#E3E7E4] rounded-md overflow-hidden print:border-none"
              dangerouslySetInnerHTML={{ __html: htmlOverride }}
            />
          ) : (
            <div className="bg-white border border-[#E3E7E4] rounded-md p-6 space-y-4 print:border-none">
              <div className="border-b-2 border-[#156145] pb-3">
                <p className="text-xs font-bold tracking-wider uppercase text-[#156145]">
                  Freetown Supermarket
                </p>
                <h3 className="font-display text-lg font-bold text-[#141715] mt-1">
                  {email.subject}
                </h3>
              </div>
              <p className="text-sm text-[#374151]">Hello {email.recipientName},</p>
              <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-line">
                {email.bodyPreview}
              </p>
              <div className="pt-4 border-t border-[#E3E7E4] text-xs text-[#5B655E]">
                Freetown Supermarket · Wilkinson Road, Freetown, Sierra Leone
              </div>
            </div>
          )}
        </div>

        <div className="no-print px-6 py-3 border-t border-[#E3E7E4] bg-white flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#141715] bg-[#EEF1EF] hover:bg-[#E1E6E3] rounded-md transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
