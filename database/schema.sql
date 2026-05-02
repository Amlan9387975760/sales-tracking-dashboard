CREATE DATABASE IF NOT EXISTS sales_dashboard;
USE sales_dashboard;

CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    instance VARCHAR(50),
    created_at DATETIME
);

CREATE TABLE IF NOT EXISTS monthly_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL,
    month VARCHAR(20) NOT NULL,
    year INT NOT NULL,
    fiscal_year VARCHAR(20) NOT NULL,
    company_status INT NOT NULL,
    status_label VARCHAR(50) NOT NULL,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_company_month_year (company_id, month, year)
);

CREATE TABLE IF NOT EXISTS import_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    month VARCHAR(20) NOT NULL,
    year INT NOT NULL,
    total_records INT DEFAULT 0,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_month_year (month, year)
);
