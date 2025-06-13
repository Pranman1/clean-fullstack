import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const plans = [
  {
    name: 'Free',
    price: 0,
    interval: 'month',
    features: [
      'Basic load search',
      'Limited to 5 searches per day',
      'Basic AI Assistant',
      'Email support',
      'Single user account'
    ],
    buttonText: 'Current Plan',
    priceId: 'free'
  },
  {
    name: 'Premium',
    price: 200,
    interval: 'month',
    features: [
      'Unlimited load searches',
      'Advanced load filtering',
      'Full AI Assistant access',
      'AI Voice Agent with unlimited calls',
      'Priority 24/7 support',
      'Multiple team accounts',
      'Custom integrations',
      'Dedicated account manager'
    ],
    buttonText: 'Subscribe',
    priceId: 'price_1RT4TwQ7ZC8Kt2tamR5rNZKI',
    popular: true
  }
];

export default function Pricing() {
  const { user } = useAuth();

  const handleSubscribe = async (priceId) => {
    if (priceId === 'free') {
      return;
    }

    try {
      console.log('Creating checkout session...');
      if (!user) {
        console.error('No user found');
        alert('Please log in to subscribe.');
        return;
      }

      console.log('User:', user);

      const response = await axios.post('https://backend-empty-fire-4935.fly.dev/stripe/create-checkout-session', {
        priceId,
        customerEmail: user.email
      });

      console.log('Response data:', response.data);

      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        alert('Failed to get checkout URL. Please try again.');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('An error occurred. Please try again.');
    }
  };

  return (
    <div style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: '40px 20px'
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '48px'
      }}>
        <h1 style={{
          fontSize: '36px',
          color: 'var(--text)',
          marginBottom: '16px'
        }}>
          Choose Your Plan
        </h1>
        <p style={{
          fontSize: '18px',
          color: 'var(--muted)'
        }}>
          Start with our free plan or unlock all features with Premium
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '32px',
        alignItems: 'start'
      }}>
        {plans.map((plan) => (
          <div
            key={plan.name}
            style={{
              background: 'var(--background)',
              borderRadius: '16px',
              padding: '32px',
              border: plan.popular ? '2px solid var(--primary)' : '1px solid var(--chrome)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              height: '100%'
            }}
          >
            {plan.popular && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                right: '24px',
                background: 'var(--primary)',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                Most Popular
              </div>
            )}

            <h2 style={{
              fontSize: '24px',
              color: 'var(--text)',
              marginBottom: '8px'
            }}>
              {plan.name}
            </h2>

            <div style={{
              fontSize: '48px',
              color: 'var(--text)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'baseline',
              gap: '4px'
            }}>
              {plan.price > 0 && <span style={{ fontSize: '24px' }}>$</span>}
              {plan.price}
              {plan.price > 0 && (
                <span style={{ fontSize: '16px', color: 'var(--muted)' }}>
                  /{plan.interval}
                </span>
              )}
            </div>

            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 32px 0',
              flex: 1
            }}>
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  style={{
                    color: 'var(--text)',
                    padding: '8px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <i className="fas fa-check" style={{ color: 'var(--primary)' }}></i>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSubscribe(plan.priceId)}
              style={{
                background: plan.popular ? 'var(--primary)' : 'var(--surface)',
                color: plan.popular ? 'white' : 'var(--text)',
                border: plan.popular ? 'none' : '2px solid var(--chrome)',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                width: '100%',
                transition: 'transform 0.2s',
                ':hover': {
                  transform: 'scale(1.02)'
                }
              }}
            >
              {plan.buttonText}
            </button>
          </div>
        ))}
      </div>

      <p style={{ 
        color: 'var(--muted)', 
        fontSize: '14px', 
        textAlign: 'center', 
        marginTop: '32px' 
      }}>
        All plans include access to our core features. Premium subscribers get unlimited access to all features.
      </p>
    </div>
  );
} 