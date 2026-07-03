import re
import os

file_path = r'e:\pjei_portfolios\frontend\src\components\AdminPanel.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
if 'useLanguage' not in content:
    content = content.replace("import { Shield", "import { useLanguage } from '../context/LanguageContext';\nimport { Shield")
    
# Add useLanguage hook
content = content.replace("export default function AdminPanel() {", "export default function AdminPanel() {\n  const { t } = useLanguage();")

replacements = [
    (r'>\s*ADMIN SYSTEM\s*<', "> {t('adminSystemAdmin')} <"),
    (r'>\s*SECURE ID\s*<', "> {t('adminSecureId')} <"),
    (r'>\s*PASSPHRASE\s*<', "> {t('adminPassphrase')} <"),
    (r'>\s*INITIALIZE CONNECTION\s*<', "> {t('adminInitConnection')} <"),
    (r'>\s*DASHBOARD\s*<', "> {t('adminDashboard')} <"),
    (r'>\s*AI MODELS\s*<', "> {t('adminAiModels')} <"),
    (r'>\s*KNOWLEDGE \(RAG\)\s*<', "> {t('adminKnowledge')} <"),
    (r'>\s*SIGN OUT\s*<', "> {t('adminSignOut')} <"),
    (r'>\s*SYSTEM OVERVIEW\s*<', "> {t('adminSystemOverview')} <"),
    (r'>\s*Online\s*<', "> {t('adminOnline')} <"),
    (r'>\s*POCKETBASE STATUS\s*<', "> {t('adminPocketbaseStatus')} <"),
    (r'>\s*Chunks\s*<', "> {t('adminChunks')} <"),
    (r'>\s*VECTORS IN QDRANT\s*<', "> {t('adminVectorsQdrant')} <"),
    (r'>\s*ACTIVE LLM ROUTE\s*<', "> {t('adminActiveLlmRoute')} <"),
    (r'>\s*AI ROUTING & BUDGETING\s*<', "> {t('adminAiRouting')} <"),
    (r'>\s*ACTIVE \(FREE\)\s*<', "> {t('adminActiveFree')} <"),
    (r'>\s*ROUTE TARGET\s*<', "> {t('adminRouteTarget')} <"),
    (r'>\s*TOTAL USAGE \(UNLIMITED\)\s*<', "> {t('adminTotalUsage')} <"),
    (r'>\s*TOKENS GENERATED\s*<', "> {t('adminTokensGenerated')} <"),
    (r'>\s*MONTHLY BUDGET LIMIT \(\$\)\s*<', "> {t('adminMonthlyBudgetLimit')} <"),
    (r'>\s*CURRENT SPEND\s*<', "> {t('adminCurrentSpend')} <"),
    (r'>\s*KNOWLEDGE BASE \(RAG\)\s*<', "> {t('adminKnowledgeBase')} <"),
    (r'>\s*SEMANTIC CHUNKING & DB MANAGEMENT\s*<', "> {t('adminSemanticChunking')} <"),
    (r'>\s*SMART UPLOAD\s*<', "> {t('adminSmartUpload')} <"),
    (r'>\s*AUTOMATED SEMANTIC PIPELINE\s*<', "> {t('adminAutoPipeline')} <"),
    (r'>1\. UPLOADING SECURE DOCUMENT\.\.\.<', ">{t('adminUploading')}<"),
    (r'>2\. ANALYZING DOCUMENT HIERARCHY\.\.\.<', ">{t('adminAnalyzing')}<"),
    (r'>3\. APPLYING SEMANTIC CHUNKING \(SPLITTING UNITS\)\.\.\.<', ">{t('adminApplying')}<"),
    (r'>4\. COMPUTING VECTOR EMBEDDINGS\.\.\.<', ">{t('adminComputing')}<"),
    (r'>\s*EDIT HIERARCHICAL CHUNK\s*<', "> {t('adminEditChunk')} <"),
    (r'>\s*FILE NAME\s*<', "> {t('adminFileName')} <"),
    (r'>\s*UNIT / MAIN TOPIC\s*<', "> {t('adminUnitTopic')} <"),
    (r'>\s*SUB-TOPIC / SECTION\s*<', "> {t('adminSubTopic')} <"),
    (r'>\s*VECTOR CONTENT \(PAYLOAD\)\s*<', "> {t('adminVectorContent')} <"),
    (r'>\s*CANCEL\s*<', "> {t('adminCancel')} <"),
    (r'>\s*COMMIT TO \.DB\s*<', "> {t('adminCommit')} <"),
    (r'placeholder="Search database contents or topics\.\.\."', "placeholder={t('adminSearch')}"),
    (r'>\s*Hierarchy \(File &gt; Topic\)\s*<', "> {t('adminHierarchy')} <"),
    (r'>\s*Vector Payload\s*<', "> {t('adminVectorPayload')} <"),
    (r'>\s*Actions\s*<', "> {t('adminActions')} <"),
    (r'>\s*MANUAL\s*<', "> {t('adminManual')} <"),
    (r'>\s*PURGE\s*<', "> {t('adminPurge')} <"),
    (r'>\s*NO SEMANTIC DATA FOUND\s*<', "> {t('adminNoData')} <"),
    (r'>\s*Upload a document to automatically populate the vector database\.\s*<', "> {t('adminUploadDoc')} <")
]

for old, new in replacements:
    content = re.sub(old, new, content)
    
# Manual replacements
content = content.replace("{ragData.length} Chunks", "{ragData.length} {t('adminChunks')}")
content = content.replace("245,602 TOKENS GENERATED", "245,602 {t('adminTokensGenerated')}")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Replaced strings in AdminPanel.tsx")
