import { useLanguage } from '../context/LanguageContext';

export default function Skills() {
  const { t } = useLanguage();

  const categories = [
    {
      title: 'categoryLanguages',
      items: [
        { icon: '☕', key: 'langJava', url: 'https://docs.oracle.com/en/java/' },
        { icon: '🐍', key: 'langPython', url: 'https://docs.python.org/3/' },
        { icon: '📜', key: 'langJavaScript', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' },
        { icon: '🎯', key: 'langKotlin', url: 'https://kotlinlang.org/docs/home.html' },
        { icon: '🔷', key: 'langDart', url: 'https://dart.dev/guides' },
        { icon: '💙', key: 'langCSharp', url: 'https://learn.microsoft.com/en-us/dotnet/csharp/' },
        { icon: '🌐', key: 'langHTML', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML' },
        { icon: '🎨', key: 'langCSS', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS' },
        { icon: 'TS', key: 'langTypeScript', url: 'https://www.typescriptlang.org/docs/' },
        { icon: '🐹', key: 'langGo', url: 'https://go.dev/doc/' },
        { icon: '🦀', key: 'langRust', url: 'https://doc.rust-lang.org/book/' },
        { icon: '🦅', key: 'langSwift', url: 'https://docs.swift.org/swift-book/' },
        { icon: '🐘', key: 'langPHP', url: 'https://www.php.net/docs.php' },
        { icon: '💎', key: 'langRuby', url: 'https://ruby-doc.org/' },
        { icon: '⚙️', key: 'langCPP', url: 'https://cplusplus.com/doc/' },
        { icon: '🗃️', key: 'langSQL', url: 'https://www.w3schools.com/sql/' },
      ]
    },
    {
      title: 'categoryFrameworks',
      items: [
        { icon: '⚛️', key: 'frameworkReact', url: 'https://react.dev/learn' },
        { icon: '📱', key: 'frameworkReactNative', url: 'https://reactnative.dev/docs/getting-started' },
        { icon: '🟢', key: 'frameworkNode', url: 'https://nodejs.org/en/docs/' },
        { icon: '∲', key: 'frameworkFlutter', url: 'https://docs.flutter.dev/' },
        { icon: '🍃', key: 'frameworkSpringBoot', url: 'https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/' },
        { icon: '⚡', key: 'frameworkDjango', url: 'https://docs.djangoproject.com/' },
        { icon: '₳', key: 'frameworkASPNET', url: 'https://learn.microsoft.com/en-us/aspnet/core/' },
        { icon: '🚀', key: 'frameworkAntigravity', url: 'https://antigravity.com/docs' },
        { icon: '🤖', key: 'frameworkCloudCode', url: 'https://docs.anthropic.com/claude/docs' },
        { icon: 'N', key: 'frameworkNextJS', url: 'https://nextjs.org/docs' },
        { icon: '🌬️', key: 'frameworkTailwind', url: 'https://tailwindcss.com/docs' },
        { icon: 'V', key: 'frameworkVue', url: 'https://vuejs.org/guide/introduction.html' },
        { icon: '🅰️', key: 'frameworkAngular', url: 'https://angular.io/docs' },
        { icon: '🔥', key: 'frameworkSvelte', url: 'https://svelte.dev/docs' },
        { icon: '🚂', key: 'frameworkExpress', url: 'https://expressjs.com/en/4x/api.html' },
        { icon: '⚡', key: 'frameworkFastAPI', url: 'https://fastapi.tiangolo.com/' },
      ]
    },
    {
      title: 'categoryAI',
      items: [
        { icon: '🧠', key: 'aiMachineLearning', url: 'https://developers.google.com/machine-learning/crash-course' },
        { icon: '♻️', key: 'aiDeepLearning', url: 'https://www.deeplearning.ai/program/deep-learning-specialization/' },
        { icon: '🐼', key: 'aiPandas', url: 'https://pandas.pydata.org/docs/' },
        { icon: '🔢', key: 'aiNumPy', url: 'https://numpy.org/doc/' },
        { icon: '🧪', key: 'aiScikit', url: 'https://scikit-learn.org/stable/user_guide.html' },
        { icon: '₮', key: 'aiTensorFlow', url: 'https://www.tensorflow.org/learn' },
        { icon: '🤖', key: 'aiMoE', url: 'https://huggingface.co/blog/moe' },
        { icon: '🔍', key: 'aiRAG', url: 'https://aws.amazon.com/what-is/retrieval-augmented-generation/' },
        { icon: '💬', key: 'aiLLMs', url: 'https://developers.google.com/machine-learning/resources/intro-llms' },
        { icon: '🔗', key: 'aiLangChain', url: 'https://python.langchain.com/docs/get_started/introduction' },
        { icon: '🔥', key: 'aiPyTorch', url: 'https://pytorch.org/tutorials/' },
        { icon: '👁️', key: 'aiOpenAI', url: 'https://platform.openai.com/docs/' },
        { icon: '🤗', key: 'aiHuggingFace', url: 'https://huggingface.co/docs' },
        { icon: 'K', key: 'aiKeras', url: 'https://keras.io/getting_started/' },
        { icon: '👁️', key: 'aiOpenCV', url: 'https://docs.opencv.org/' },
        { icon: '⚙️', key: 'aiMLOps', url: 'https://ml-ops.org/' },
      ]
    },
    {
      title: 'categoryDatabases',
      items: [
        { icon: '🐘', key: 'dbPostgreSQL', url: 'https://www.postgresql.org/docs/' },
        { icon: '🍃', key: 'dbMongoDB', url: 'https://www.mongodb.com/docs/' },
        { icon: '🔥', key: 'dbFirebase', url: 'https://firebase.google.com/docs' },
        { icon: '🗄️', key: 'dbMySQL', url: 'https://dev.mysql.com/doc/' },
        { icon: '☁️', key: 'dbAWS', url: 'https://docs.aws.amazon.com/' },
        { icon: '🌩️', key: 'dbAzure', url: 'https://learn.microsoft.com/en-us/azure/' },
        { icon: '⚡', key: 'dbSupabase', url: 'https://supabase.com/docs' },
        { icon: '☁️', key: 'dbCloudflare', url: 'https://developers.cloudflare.com/' },
        { icon: '▲', key: 'dbVercel', url: 'https://vercel.com/docs' },
        { icon: '🔴', key: 'dbRedis', url: 'https://redis.io/docs/' },
        { icon: '☁️', key: 'dbGCP', url: 'https://cloud.google.com/docs' },
        { icon: '🔴', key: 'dbOracle', url: 'https://docs.oracle.com/en/database/' },
        { icon: '🪶', key: 'dbSQLite', url: 'https://www.sqlite.org/docs.html' },
        { icon: '👁️', key: 'dbCassandra', url: 'https://cassandra.apache.org/doc/latest/' },
        { icon: '🔍', key: 'dbElasticSearch', url: 'https://www.elastic.co/guide/index.html' },
        { icon: '❄️', key: 'dbSnowflake', url: 'https://docs.snowflake.com/' },
      ]
    },
    {
      title: 'categoryTools',
      items: [
        { icon: '🐳', key: 'toolDocker', url: 'https://docs.docker.com/' },
        { icon: '🌐', key: 'toolGit', url: 'https://git-scm.com/doc' },
        { icon: '🤖', key: 'toolAndroidStudio', url: 'https://developer.android.com/studio/intro' },
        { icon: '💻', key: 'toolVSCode', url: 'https://code.visualstudio.com/docs' },
        { icon: '📊', key: 'toolPostman', url: 'https://learning.postman.com/docs/getting-started/introduction/' },
        { icon: '🔄', key: 'toolCICD', url: 'https://docs.github.com/en/actions' },
        { icon: '☸️', key: 'toolKubernetes', url: 'https://kubernetes.io/docs/home/' },
        { icon: '🐙', key: 'toolGitHubActions', url: 'https://docs.github.com/en/actions' },
        { icon: '🏗️', key: 'toolTerraform', url: 'https://developer.hashicorp.com/terraform/docs' },
        { icon: '🎨', key: 'toolFigma', url: 'https://help.figma.com/' },
        { icon: '🤵', key: 'toolJenkins', url: 'https://www.jenkins.io/doc/' },
        { icon: '🐧', key: 'toolLinux', url: 'https://linuxcommand.org/' },
        { icon: '🎯', key: 'toolJira', url: 'https://confluence.atlassian.com/alldoc/atlassian-documentation-32243719.html' },
        { icon: '📦', key: 'toolWebpack', url: 'https://webpack.js.org/concepts/' },
        { icon: '⚡', key: 'toolVite', url: 'https://vitejs.dev/guide/' },
        { icon: '💬', key: 'toolSlack', url: 'https://api.slack.com/' },
      ]
    }
  ];

  return (
    <section id="arsenal">
      <div className="container">
        <h2 className="section-header">{t('arsenalHeader')}</h2>
        <div className="tech-categories">
          {categories.map((category, idx) => (
             <div className="tech-category" key={idx}>
              <h3 className="category-title">{t(category.title as any)}</h3>
              <div className="tech-grid">
                {category.items.map((item, i) => (
                  <a 
                    href={item.url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="tech-item glass glow" 
                    key={i}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div className="tech-icon">{item.icon}</div>
                    <h4>{t(item.key as any)}</h4>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
