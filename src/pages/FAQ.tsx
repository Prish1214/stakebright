import { Layout } from '@/components/Layout';
import CyberCard from '@/components/ui/CyberCard';
import { HelpCircle } from 'lucide-react';

const faqData = [
  {
    question: "How do I start staking?",
    answer: "Simply create an account, deposit your stablecoins, and choose a staking plan that fits your goals."
  },
  {
    question: "When do I receive profits?",
    answer: "Profits are calculated and added to your account daily based on your active staking plans."
  },
  {
    question: "Is my investment safe?",
    answer: "We employ multiple security measures including cold storage and strict risk management protocols."
  },
  {
    question: "How do withdrawals work?",
    answer: "Request a withdrawal anytime. Earnings are processed within 24-48 hours after admin approval."
  }
];

const FAQ = () => {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-mono font-bold gradient-text mb-2">
          Frequently Asked Questions
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Find answers to common questions about our platform
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        {faqData.map((faq, index) => (
          <CyberCard key={index} hoverable className="animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
            <div className="p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="w-4 h-4 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-mono text-primary text-sm sm:text-base font-semibold">
                    {faq.question}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          </CyberCard>
        ))}
      </div>
    </div>
  );
};

export default FAQ;
