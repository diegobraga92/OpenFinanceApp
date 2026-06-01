-- Create pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Chart of Accounts table
-- This table stores the standard chart of accounts for double-entry bookkeeping.
-- Account types follow accounting standards:
--   asset    = things the user owns (e.g., cash, bank accounts, investments)
--   liability = debts or obligations (e.g., credit card, loans)
--   equity   = net worth (owner's equity, retained earnings)
--   income   = money received (e.g., salary, interest)
--   expense  = money spent (e.g., groceries, rent)
-- normal_balance indicates which side increases the account:
--   debit  = asset, expense
--   credit = liability, equity, income
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
    normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for type-based queries
CREATE INDEX idx_accounts_type ON accounts (type);

-- Seed some default accounts
INSERT INTO accounts (code, name, type, normal_balance) VALUES
    ('1000', 'Cash', 'asset', 'debit'),
    ('1100', 'Checking Account', 'asset', 'debit'),
    ('1200', 'Savings Account', 'asset', 'debit'),
    ('1300', 'Credit Card', 'liability', 'credit'),
    ('1400', 'Loan', 'liability', 'credit'),
    ('3000', 'Salary', 'income', 'credit'),
    ('3100', 'Interest Income', 'income', 'credit'),
    ('4000', 'Food & Groceries', 'expense', 'debit'),
    ('4100', 'Housing', 'expense', 'debit'),
    ('4200', 'Transportation', 'expense', 'debit'),
    ('4300', 'Utilities', 'expense', 'debit'),
    ('4400', 'Entertainment', 'expense', 'debit'),
    ('4500', 'Healthcare', 'expense', 'debit'),
    ('4600', 'Education', 'expense', 'debit'),
    ('5000', 'Miscellaneous', 'expense', 'debit');