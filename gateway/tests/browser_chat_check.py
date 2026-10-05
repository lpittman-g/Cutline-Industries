"""Browser acceptance test using real application handlers and simulated model output; no external requests."""
import io,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from playwright.sync_api import sync_playwright
from artemis.business import Business
from artemis.conversations import Conversations
from artemis.chat_jobs import ChatJobs
from artemis.chat_app import make_chat_handler
from artemis.orchestrator import Artemis
from artemis.backends import ModelUnavailable
import artemis.chat_app as gateway
ROOT=Path(__file__).resolve().parents[1]
class Model:
 def __init__(self):self.mode='ok'
 def stream(self,brain,system,messages,max_tokens=512):
  if self.mode=='error':
   yield 'Retained partial response. '
   raise ModelUnavailable('Model unavailable. Retry later.')
  yield 'Here is the answer.\n\n```python\nprint(6*7)\n```\n<img src=x onerror=alert(1)>'
 def generate(self,*args,**kwargs):return ''.join(self.stream(*args,**kwargs))
biz=Business(':memory:');records=Conversations(biz.db);model=Model();app=Artemis(model);jobs=ChatJobs(app,biz,records,workers=2)
gateway.ALLOWED_ORIGINS.add('https://artemis.local')
handler=make_chat_handler(app,biz,records,jobs)
class Socket:
 def __init__(self,data):self.input=io.BytesIO(data);self.output=bytearray()
 def makefile(self,*args):return self.input
 def sendall(self,data):self.output.extend(data)
def route_handler(route):
 request=route.request;url=request.url
 if not url.startswith('https://artemis.local/'):
  route.abort();return
 path=url.split('https://artemis.local',1)[1]
 body=(request.post_data or '').encode();headers={**request.all_headers(),'Content-Length':str(len(body))}
 raw=f'{request.method} {path} HTTP/1.0\r\n'+''.join(f'{key}: {value}\r\n' for key,value in headers.items())+'\r\n'
 sock=Socket(raw.encode()+body);handler(sock,('127.0.0.1',1234),None)
 head,_,payload=bytes(sock.output).partition(b'\r\n\r\n');lines=head.decode().split('\r\n');status=int(lines[0].split(' ')[1])
 response_headers={key.strip():value.strip() for line in lines[1:] if ':' in line for key,value in [line.split(':',1)]}
 route.fulfill(status=status,headers=response_headers,body=payload)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block')
  context.route('**/*',route_handler);page=context.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('https://artemis.local/chat/',wait_until='domcontentloaded')
  page.locator('header nav [data-go="chat"]').click()
  page.wait_for_function('document.querySelector("#prompt").disabled')
  assert page.locator('#view-chat').is_visible()
  page.locator('.workspace-account').click()
  page.locator('#account-page-content form button').filter(has_text='Create an account').click()
  assert page.locator('#view-account').is_visible()
  page.locator('#account-email').fill('browser@example.com')
  page.locator('#account-password').fill('a-long-test-password')
  page.locator('#account-page-content form button[type="submit"]').click()
  page.wait_for_function('!document.querySelector("#prompt").disabled')
  page.evaluate("""() => {
    const original = window.fetch; let inject = true;
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (inject && String(args[0]).includes('/events?') && response.ok) {
        inject = false; const text = await response.text();
        const frame = text.split('\\n\\n')[0] + '\\n\\n';
        return new Response(new ReadableStream({ start(controller) {
          controller.enqueue(new TextEncoder().encode(frame));
          setTimeout(() => controller.error(new Error('simulated disconnect')), 40);
        }}), { headers: { 'Content-Type': 'text/event-stream' } });
      }
      return response;
    };
  }""")
  page.locator('#prompt').fill('Hello')
  page.locator('#composer').evaluate('(form)=>form.requestSubmit()')
  page.wait_for_function('document.querySelector("#composer").getAttribute("aria-busy")==="false" && document.querySelectorAll(".msgs .sys").length===1')
  assert 'Here is the answer.' in page.locator('.msgs .sys').inner_text()
  assert records.db.one("SELECT COUNT(*) FROM chat_request_events WHERE kind='stream_connected'")[0]>=2
  assert page.locator('.msgs .sys img').count()==0
  page.locator('#workspace-tab-code').click()
  assert page.locator('#workspace-panel-code .codeblock').count()==1
  page.locator('#workspace-tab-chat').click()
  page.reload(wait_until='domcontentloaded')
  page.wait_for_selector('.msgs .sys')
  assert 'Here is the answer.' in page.locator('.msgs .sys').inner_text()
  page.on('dialog',lambda dialog:dialog.accept('Edited hello'))
  page.locator('.msgs .user .message-actions button').filter(has_text='Edit').click()
  page.wait_for_function('document.querySelector("#composer").getAttribute("aria-busy")==="false" && document.querySelector(".workspace-branches select").options.length===2')
  assert page.locator('.msgs .user').inner_text().startswith('Edited hello')
  model.mode='error'
  page.locator('#prompt').fill('Show a failure')
  page.locator('#composer').evaluate('(form)=>form.requestSubmit()')
  page.wait_for_function('document.querySelector("#composer").getAttribute("aria-busy")==="false" && document.querySelectorAll(".msgs .sys").length===2')
  assert 'Retained partial response.' in page.locator('.msgs .sys').last.inner_text()
  assert 'Model unavailable' in page.locator('.msgs .sys').last.inner_text()
  assert page.locator('.msgs .sys').last.get_by_role('button',name='Retry',exact=True).is_visible()
  page.locator('aside .new').click()
  page.wait_for_selector('.workspace-welcome')
  page.wait_for_timeout(400)
  page.screenshot(path=str(ROOT/'site'/'preview-desktop.png'),full_page=True)
  page.set_viewport_size({'width':390,'height':844})
  assert page.locator('.session-mobile').is_visible()
  assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
  page.screenshot(path=str(ROOT/'site'/'preview-mobile.png'),full_page=True)
  page.locator('#menuBtn').click()
  page.locator('header nav [data-go="products"]').click()
  assert page.locator('#view-products').is_visible()
  assert page.locator('.product-card').count()==3
  assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
  page.wait_for_timeout(600)
  page.screenshot(path=str(ROOT/'site'/'preview-products-mobile.png'),full_page=True)
  page.locator('#menuBtn').click()
  page.locator('#accountNav').click()
  assert page.locator('#view-account').is_visible()
  page.locator('#account-page-content').get_by_role('button',name='Account settings',exact=True).click()
  page.locator('dialog').get_by_role('button',name='Sign out',exact=True).click()
  page.wait_for_selector('#account-page-content form:visible')
  page.screenshot(path=str(ROOT/'site'/'preview-sign-in-mobile.png'),full_page=True)
  page.locator('#account-email').fill('browser@example.com')
  page.locator('#account-password').fill('a-long-test-password')
  page.locator('#account-page-content form button[type="submit"]').click()
  page.wait_for_function('!document.querySelector("#prompt").disabled')
  assert page.locator('#view-chat').is_visible()
  page.goto('https://artemis.local/', wait_until='domcontentloaded')
  page.locator('#full-name').fill('Browser check')
  page.locator('#email').fill('browser@example.com')
  page.locator('#contact-form').evaluate('(form)=>form.requestSubmit()')
  assert page.locator('#contact-form').is_visible()
  assert 'Nothing was sent' in page.locator('#thanks').inner_text()
  assert page.locator('#hero-canvas').count() == 1
  assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
  page.screenshot(path=str(ROOT/'site'/'preview-current-home-mobile.png'),full_page=True)
  page.route('**/api/me', lambda route: route.fulfill(status=404, body='NOT_FOUND', content_type='text/plain'))
  page.goto('https://artemis.local/account/', wait_until='domcontentloaded')
  page.wait_for_function('document.querySelector("#account-page-content [role=alert]").textContent.includes("temporarily unavailable")')
  assert page.locator('#account-page-content button[type=submit]').is_disabled()
  assert page.get_by_role('button', name='Check connection again', exact=True).is_visible()
  page.screenshot(path=str(ROOT/'site'/'preview-account-service-unavailable.png'),full_page=True)
  assert not errors,errors
  print('PASS: Chat navigation, secure-cookie signup, reconnect after interrupted stream, server-saved reply, reload restoration, safe rendering, code view, edited branch preservation, retained failed partial reply, Retry control, mobile session picker, no overflow or browser errors.')
  browser.close()
finally:
 jobs.shutdown();app.pool.shutdown()
