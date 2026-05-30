from docx import Document
import json

doc = Document('Documentacion/Punto_6_Pruebas_EcoVigia.docx')
tables_data = []

for i, table in enumerate(doc.tables):
    table_content = []
    for row in table.rows:
        row_content = [cell.text.replace('\n', ' ') for cell in row.cells]
        table_content.append(row_content)
    tables_data.append(table_content)

print(json.dumps(tables_data, indent=2))
