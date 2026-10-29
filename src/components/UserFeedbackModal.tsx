import React, { useState } from 'react';
import { Camera, CheckCircle2, Image as ImageIcon, MessageSquare, Send, Trash2, X } from 'lucide-react';
import { submitUserFeedback } from '../engine/userFeedbackEngine';
import { useTheme } from '../context/ThemeContext';

interface UserFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultUserName?: string;
  defaultUserEmail?: string;
  deviceId?: string;
  industryMode?: string;
}

export const UserFeedbackModal: React.FC<UserFeedbackModalProps> = ({
  isOpen,
  onClose,
  defaultUserName = '',
  defaultUserEmail = '',
  deviceId = '',
  industryMode = 'NATM',
}) => {
  const { palette } = useTheme();
  const [userName, setUserName] = useState<string>(defaultUserName || 'Field Geologist');
  const [userEmail, setUserEmail] = useState<string>(defaultUserEmail || '');
  const [message, setMessage] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('');

  if (!isOpen) return null;

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setStatusText('Please enter your feedback message.');
      return;
    }

    setIsSubmitting(true);
    setStatusText('Sending feedback to Master...');

    const res = await submitUserFeedback({
      userName,
      userEmail,
      deviceId,
      industryMode,
      message,
      photoUrl,
    });

    setIsSubmitting(false);
    if (res.success) {
      setSubmitSuccess(true);
      setStatusText(res.message);
      setTimeout(() => {
        onClose();
        setSubmitSuccess(false);
        setMessage('');
        setPhotoUrl('');
        setStatusText('');
      }, 1800);
    } else {
      setStatusText(res.message || 'Failed to submit feedback. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
              style={{
                backgroundColor: palette.primaryHex + '25',
                color: palette.accentIconColor,
              }}
            >
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Send Feedback to Master
              </h3>
              <p className="text-[11px] text-slate-400">
                Share geological suggestions, bugs, or field notes with Master Admin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        {submitSuccess ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40 animate-in zoom-in-75">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white">Feedback Received!</h4>
            <p className="text-xs text-slate-300 max-w-sm leading-relaxed">{statusText}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* User Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-300">Your Name</span>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Geologist Name"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-semibold text-slate-300">Email Address (Optional)</span>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="engineer@mine.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </label>
            </div>

            {/* Message Body */}
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-300">
                Feedback Message / Issue Details <span className="text-amber-400">*</span>
              </span>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what you observed, suggested enhancements, or questions about the geological logging or mapping..."
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
                required
              />
            </label>

            {/* Photo / Screenshot Attachment */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">
                Attach Excavation Photo or Screenshot (Optional)
              </span>

              {photoUrl ? (
                <div className="relative rounded-xl border border-slate-700 overflow-hidden bg-slate-950 p-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={photoUrl}
                      alt="Attachment preview"
                      className="w-14 h-14 object-cover rounded-lg border border-slate-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white truncate block">Image Attached</span>
                      <span className="text-[10px] text-slate-400">Ready to send with report</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="p-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 cursor-pointer transition-colors shrink-0"
                    title="Remove attached photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-3.5 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 hover:bg-slate-950 hover:border-slate-600 transition-colors cursor-pointer text-slate-400 hover:text-slate-200">
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium">Click to choose image or take camera photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {statusText && !submitSuccess && (
              <p className="text-xs font-mono text-amber-300 bg-amber-950/40 p-2 rounded-lg border border-amber-800/60">
                {statusText}
              </p>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Feedback</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
