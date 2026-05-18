import PyPDF2
import sys
import zipfile
import xml.etree.ElementTree as ET

def extract_pdf(pdf_path):
    text = ""
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        for page in reader.pages:
            text += page.extract_text() + "\n"
    return text

def extract_docx(docx_path):
    text = ""
    try:
        with zipfile.ZipFile(docx_path) as docx:
            xml_content = docx.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            for node in tree.iter():
                if node.tag.endswith('}t'):
                    if node.text:
                        text += node.text + " "
                elif node.tag.endswith('}p'):
                    text += "\n"
    except Exception as e:
        text = str(e)
    return text

if __name__ == "__main__":
    with open('report_content.txt', 'w', encoding='utf-8') as f:
        f.write("--- PDF ---\n")
        f.write(extract_pdf(sys.argv[1]))
        f.write("\n--- DOCX ---\n")
        f.write(extract_docx(sys.argv[2]))
