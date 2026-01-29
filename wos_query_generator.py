# -*- coding: utf-8 -*-
"""
WoS Advanced Search Query Generator
Generate Web of Science advanced search expressions based on AJG2024 journal list.
Supports filtering by star rating, field, FT50, and UTD24.
"""

import pandas as pd
import os


def load_excel(file_path):
    """Load Excel file and return DataFrame."""
    return pd.read_excel(file_path)


def generate_wos_query(df, star_levels=None, fields=None, ft50=False, utd24=False):
    """
    Generate WoS advanced search query expression.
    
    Args:
        df: DataFrame containing journal data
        star_levels: List of star ratings, e.g. [3, 4, '4*'] or None for all
        fields: List of fields, e.g. ['FINANCE', 'ECON'] or None for all
        ft50: Filter FT50 journals only
        utd24: Filter UTD24 journals only
    
    Returns:
        tuple: (WoS query string, journal count, journal list[(name, ISSN)])
    """
    filtered_df = df.copy()
    
    # Filter FT50/UTD24 (read from Excel columns)
    if ft50 and utd24:
        # both: FT50 OR UTD24 (union)
        filtered_df = filtered_df[(filtered_df['is_ft50'] == 1) | (filtered_df['is_utd24'] == 1)]
    elif ft50:
        filtered_df = filtered_df[filtered_df['is_ft50'] == 1]
    elif utd24:
        filtered_df = filtered_df[filtered_df['is_utd24'] == 1]
    
    # Filter by star rating
    if star_levels is not None:
        filtered_df['ajg_2024_str'] = filtered_df['ajg_2024'].astype(str)
        star_levels_str = [str(s) for s in star_levels]
        filtered_df = filtered_df[filtered_df['ajg_2024_str'].isin(star_levels_str)]
    
    # Filter by field
    if fields is not None:
        filtered_df = filtered_df[filtered_df['field'].isin(fields)]
    
    # Get valid ISSN records
    valid_df = filtered_df[filtered_df['print_issn'].notna()].copy()
    valid_df['issn_clean'] = valid_df['print_issn'].astype(str).str.strip()
    valid_df = valid_df[valid_df['issn_clean'] != 'nan']
    
    if len(valid_df) == 0:
        return None, 0, []
    
    issn_list = valid_df['issn_clean'].tolist()
    journal_list = valid_df[['title', 'issn_clean']].values.tolist()
    
    # Generate WoS query expression
    wos_query = 'IS=(' + ' OR '.join(issn_list) + ')'
    return wos_query, len(issn_list), journal_list


def main():
    # Get script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, 'AJG2024.xlsx')
    
    print("Loading Excel file...")
    df = load_excel(file_path)
    print(f"Loaded {len(df)} records\n")
    
    # Display available options
    print("=" * 70)
    print("Available star ratings: 1, 2, 3, 4, 4*")
    print("=" * 70)
    print("Available fields:")
    for field, count in df['field'].value_counts().items():
        print(f"  {field}: {count} journals")
    print("=" * 70)
    
    # Generate common query examples
    print("\nCommon Query Examples")
    print("=" * 70)
    
    examples = [
        ("FT50 Journals", {"ft50": True}),
        ("UTD24 Journals", {"utd24": True}),
        ("4* Star Journals", {"star_levels": ['4*']}),
        ("4 & 4* Star Journals", {"star_levels": [4, '4*']}),
    ]
    
    for name, kwargs in examples:
        query, count, journals = generate_wos_query(df, **kwargs)
        print(f"\n[{name}] ({count} journals):")
        print("-" * 70)
        print(query)
        print("\nJournal List:")
        for i, (title, issn) in enumerate(journals, 1):
            print(f"{i:3}. {title} ({issn})")
    
    # Interactive query generation
    print("\n\nCustom Query Generator")
    print("=" * 70)
    
    special = input("\nFilter special list? (ft50/utd24/both, Enter to skip): ").strip().lower()
    ft50_filter = special in ['ft50', 'both']
    utd24_filter = special in ['utd24', 'both']
    
    star_input = input("Filter by star rating (e.g. 3,4,4* or 3 4 4*, Enter for all): ").strip()
    if star_input:
        # Support comma or space as delimiter
        star_input = star_input.replace(',', ' ')
        star_levels = [s.strip() for s in star_input.split() if s.strip()]
    else:
        star_levels = None
    
    field_input = input("Filter by field (e.g. FINANCE,ECON or FINANCE ECON, Enter for all): ").strip()
    if field_input:
        # Support comma or space as delimiter
        field_input = field_input.replace(',', ' ')
        fields_filter = [f.strip() for f in field_input.split() if f.strip()]
    else:
        fields_filter = None
    
    query, count, journals = generate_wos_query(df, star_levels, fields_filter, ft50_filter, utd24_filter)
    
    if query:
        print("\n" + "=" * 70)
        print(f"Matched journals: {count}")
        print("=" * 70)
        print("\nWoS Advanced Search Expression:")
        print("-" * 70)
        print(query)
        print("\nJournal List:")
        for i, (title, issn) in enumerate(journals, 1):
            print(f"{i:3}. {title} ({issn})")
    else:
        print("No journals found matching the criteria")


if __name__ == "__main__":
    main()
