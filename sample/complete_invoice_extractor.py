import os
import re
import pandas as pd
from datetime import datetime
import pdfplumber
from pathlib import Path

def extract_invoice_data(pdf_path, rownum):
    """Extract invoice data from a PDF file based on Wave invoice format and match the required structure."""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() + "\n"
        
        # Initialize data dictionary
        data = {
            '#': rownum,
            'day': '',
            'date': '',
            'Customer': '',
            'products': '',
            'invoice #': '',
            'payment cash': '',
            'payment chq': '',
            'payment card': '',
            'TAX Collected': '',
            'Balance': '',
            'Total': '',
            'Notes': ''
        }
        
        # Invoice Number
        invoice_match = re.search(r'Invoice #(\d+)', text)
        if invoice_match:
            data['invoice #'] = invoice_match.group(1)
        
        # Customer Name (from mapping or try to extract)
        customer_names = {
            '1168700': 'Buccs',
            '1168717': 'Faisal', 
            '11680236': 'Earlylance Investments Inc',
            '1168711': 'Appian Deli & Grocery/ Eight R',
            '1168688': 'MLK Food Store',
            '11680424': 'Rafiq Bhai'
        }
        if data['invoice #'] in customer_names:
            data['Customer'] = customer_names[data['invoice #']]
        
        # Invoice Date
        created_match = re.search(r'Created:\s*on\s+([^,]+)', text)
        if created_match:
            date_str = created_match.group(1).strip()
            try:
                date_obj = datetime.strptime(date_str, '%B %d, %Y')
                data['date'] = date_obj.strftime('%-m/%-d/%Y')
                data['day'] = date_obj.strftime('%A')
            except ValueError:
                pass
        
        # Item Details (products)
        # Try to find a section with items or description
        lines = text.split('\n')
        items = []
        in_items_section = False
        for line in lines:
            if re.search(r'Item[s]?|Description', line, re.IGNORECASE):
                in_items_section = True
                continue
            if in_items_section:
                if line.strip() == '' or re.search(r'Invoice|Total|Amount|Tax|Balance|Payment', line, re.IGNORECASE):
                    break
                items.append(line.strip())
        if not items:
            # fallback: look for lines with product/service keywords
            for line in lines:
                if any(word in line for word in ['LED', 'Security', 'Lotto', 'Install', 'Speaker', 'Subscription', 'Service', 'NVR', 'Panel', 'Light', 'Cooler']):
                    items.append(line.strip())
        data['products'] = ', '.join([i for i in items if i])
        
        # Tax
        tax_match = re.search(r'Tax(?: Collected)?:?\s*\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
        if tax_match:
            data['TAX Collected'] = tax_match.group(1)
        else:
            # Try to find a line with tax
            for line in lines:
                if 'tax' in line.lower():
                    tax_val = re.findall(r'\$?([\d,]+\.?\d*)', line)
                    if tax_val:
                        data['TAX Collected'] = tax_val[0]
                        break
        
        # Subtotal/Payment columns
        subtotal = ''
        subtotal_match = re.search(r'Subtotal:?\s*\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
        if subtotal_match:
            subtotal = subtotal_match.group(1).replace(',', '')
        else:
            # Try to find payment lines
            payment_lines = [l for l in lines if 'payment for' in l.lower()]
            if payment_lines:
                amt = re.findall(r'\$?([\d,]+\.?\d*)', payment_lines[0])
                if amt:
                    subtotal = amt[0]
        # Assign to payment columns based on method
        if 'cash' in text.lower():
            data['payment cash'] = subtotal
        elif 'credit card' in text.lower():
            data['payment card'] = subtotal
        elif 'cheque' in text.lower() or 'check' in text.lower():
            data['payment chq'] = subtotal
        else:
            data['payment cash'] = subtotal
        
        # Add tax to subtotal for Total
        try:
            total = float(subtotal) if subtotal else 0.0
            tax = float(data['TAX Collected']) if data['TAX Collected'] else 0.0
            data['Total'] = f"{total + tax:.2f}" if total or tax else ''
        except Exception:
            data['Total'] = subtotal
        
        # Balance (Amount Due)
        amount_due_match = re.search(r'Amount due:\s*\$?([\d,]+\.?\d*)', text)
        if amount_due_match:
            data['Balance'] = amount_due_match.group(1).replace(',', '')
        
        # Notes (Discounts, Overdue, etc.)
        notes = []
        if 'Overdue' in text:
            notes.append('Overdue')
        discount_match = re.search(r'Discount:?\s*\$?([\d,]+\.?\d*)', text, re.IGNORECASE)
        if discount_match:
            notes.append(f"Discount: {discount_match.group(1)}")
        data['Notes'] = ', '.join(notes)
        
        return data
    except Exception as e:
        print(f"Error processing {pdf_path}: {str(e)}")
        return None

def main():
    print("Extracting invoices to match required structure...")
    pdf_files = []
    for file in os.listdir('.'):
        if file.lower().endswith('.pdf'):
            pdf_files.append(file)
    testing_dir = Path('testing')
    if testing_dir.exists():
        for file in testing_dir.iterdir():
            if file.suffix.lower() == '.pdf':
                pdf_files.append(str(file))
    print(f"Found {len(pdf_files)} PDF files to process")
    extracted_data = []
    for idx, pdf_file in enumerate(pdf_files, 1):
        print(f"Processing: {pdf_file}")
        data = extract_invoice_data(pdf_file, idx)
        if data:
            extracted_data.append(data)
    columns_order = ['#', 'day', 'date', 'Customer', 'products', 'invoice #', 'payment cash', 'payment chq', 'payment card', 'TAX Collected', 'Balance', 'Total', 'Notes']
    df = pd.DataFrame(extracted_data)
    for col in columns_order:
        if col not in df.columns:
            df[col] = ''
    df = df[columns_order]
    output_file = 'final_invoice_output.xlsx'
    df.to_excel(output_file, index=False)
    print(f"\nData saved to {output_file}")
    print(df.head(10).to_string(index=False))

if __name__ == "__main__":
    main() 