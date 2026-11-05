import { certificateRoutes } from './certificates.mjs';
import { supportRoutes } from './support.mjs';
import { randomUUID } from 'node:crypto';
import { indicators, reviewReasons } from '../services/indicators.mjs';
import { ApiError, assert, str, date, json, parseBody } from '../middleware/http.mjs';
import { scopedWorkspace, requireRole, memberAccess } from '../services/access.mjs';
import { enrollMember } from '../services/members.mjs';
import { captureVisit } from '../services/visits.mjs';
import { operations } from './operations.mjs';
import { healthRoutes } from './health.mjs';
import { addBulkCore, bulkSupportExamples } from '../services/bulk-demo.mjs';
import { localDate } from '../services/dates.mjs';
import { CURRENCIES, LANGUAGES, validMoney } from '../../shared/catalog.mjs';

export function createApiRouter({ repository, auth, demo, authority }) {
  const { read, save } = repository;
  const audit = (s, user, action) =>
    s.audit.unshift({ id: randomUUID(), at: new Date().toISOString(), actor: user.name, action });
  let mutation = Promise.resolve();
  async function handle(req, res, url, b) {
    const path = url.pathname;
    if (path === '/api/session' && req.method === 'GET') {
      const current = auth.userFor(req);
      return json(res, 200, {
        user: current ? { id: current.id, name: current.name, role: current.role, expires: current.expires } : null,
        demo,
      });
    }
    if (path === '/api/login' && req.method === 'POST') return json(res, 200, auth.login(req, res, b));
    const user = auth.userFor(req);
    assert(user, 'Please sign in', 401);
    if (path === '/api/logout' && req.method === 'POST') {
      auth.logout(res, user);
      return json(res, 200, { ok: true });
    }
    const s = read();
    if (path === '/api/workspace' && req.method === 'GET') {
      const staff = [
        {
          id: 'admin',
          username: 'admin',
          name: demo ? 'Asha Patil' : 'Administrator',
          role: 'admin',
          active: true,
          groupIds: [],
        },
        ...repository.listStaff(),
      ];
      return json(res, 200, {
        ...scopedWorkspace(s, user, staff),
        credentialSettings: authority?.settings(s),
        demo,
        storage: { encrypted: repository.encrypted },
        offlineAccess: {
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        },
        user: { id: user.id, name: user.name, role: user.role, groupIds: user.groupIds },
      });
    }
    if (path.startsWith('/api/certificates/'))
      return await certificateRoutes({ req, res, url, b, s, user, repository, demo, audit, authority });
    if (supportRoutes({ req, res, url, b, s, user, repository, demo, audit })) return;
    if (healthRoutes({ req, res, url, b, s, user, repository, demo, audit })) return;
    if (operations({ req, res, url, b, s, user, repository, demo, audit, auth })) return;
    if (path === '/api/demo/bulk' && req.method === 'POST') {
      requireRole(user, 'admin');
      assert(demo, 'Sample data is available only in demo mode', 403);
      assert(!s.config.bulkDemoLoaded, 'The larger sample dataset is already loaded', 409);
      const today = localDate(s.config.timeZone);
      const counts = addBulkCore(s, today);
      s.supportPeople ||= [];
      // Each support record passes through the real route validation; nothing is saved unless all succeed.
      const noSave = { ...repository, save() {} };
      const stub = { writeHead() {}, end() {} };
      for (const [route, body] of bulkSupportExamples(s, today))
        supportRoutes({
          req: { method: 'POST' },
          res: stub,
          url: { pathname: '/api/support/' + route },
          b: body,
          s,
          user,
          repository: noSave,
          demo,
          audit: () => {},
        });
      s.config.bulkDemoLoaded = true;
      audit(s, user, 'Loaded larger fictional demonstration dataset');
      save(s);
      return json(res, 201, { ...counts, supportRecords: s.supportPeople.length });
    }
    if (path === '/api/groups' && req.method === 'POST') {
      requireRole(user, 'admin', 'supervisor');
      assert(str(b.name) && str(b.officer) && date(b.nextMeeting), 'Complete all group fields');
      assert(!b.location, 'New groups do not collect location data');
      const group = {
        id: 'GRP-' + randomUUID().slice(0, 8),
        name: b.name.trim(),
        location: '',
        officer: b.officer.trim(),
        nextMeeting: b.nextMeeting,
        time: '09:00',
        color: 'teal',
      };
      s.groups.push(group);
      audit(s, user, `Created group ${group.id}`);
      save(s);
      return json(res, 201, group);
    }
    if (path === '/api/members' && req.method === 'POST') {
      const member = enrollMember(s, b, user);
      s.members.push(member);
      audit(s, user, `Enrolled member ${member.id}`);
      save(s);
      return json(res, 201, member);
    }
    if (path === '/api/loans' && req.method === 'POST') {
      requireRole(user, 'admin', 'supervisor');
      const member = memberAccess(s, user, b.memberId),
        currency = b.currency || member.currency || s.settings.currency;
      assert(
        CURRENCIES.includes(currency) &&
          validMoney(b.principal, currency) &&
          b.principal > 0 &&
          validMoney(b.installment, currency) &&
          b.installment > 0 &&
          b.installment <= b.principal &&
          str(b.purpose) &&
          date(b.date) &&
          ['weekly', 'fortnightly', 'monthly'].includes(b.frequency),
        'Check the loan details and currency precision'
      );
      assert(Math.ceil(b.principal / b.installment) <= 600, 'Use at most 600 installments per loan');
      const loan = {
        id: 'LN-' + randomUUID().slice(0, 8),
        currency,
        memberId: b.memberId,
        principal: b.principal,
        installment: b.installment,
        purpose: b.purpose.trim(),
        date: b.date,
        frequency: b.frequency,
        status: 'active',
      };
      s.loans.push(loan);
      audit(s, user, `Recorded externally approved interest-free loan ${loan.id}`);
      save(s);
      return json(res, 201, loan);
    }
    if (path === '/api/visits' && req.method === 'POST') {
      memberAccess(s, user, b.memberId);
      const { visit, created } = captureVisit(s, b, user);
      if (created) {
        audit(s, user, `Recorded visit ${visit.id} for ${visit.memberId}`);
        save(s);
      }
      return json(res, created ? 201 : 200, visit);
    }
    const match = path.match(/^\/api\/members\/([^/]+)\/(consent|export|verify)$/);
    if (match) {
      const m = memberAccess(s, user, match[1]);
      if (match[2] === 'verify' && req.method === 'POST') {
        m.kycVerified = true;
        audit(s, user, `Attested in-person identity check for ${m.id}`);
        save(s);
        return json(res, 200, m);
      }
      if (match[2] === 'consent' && req.method === 'POST') {
        assert(typeof b.granted === 'boolean', 'Consent choice required');
        if (b.granted)
          assert(
            str(b.recipient) && str(b.purpose) && b.attested === true,
            'Recipient, purpose and member attestation required'
          );
        m.consent = b.granted
          ? {
              granted: true,
              recipient: b.recipient.trim(),
              purpose: b.purpose.trim(),
              at: new Date().toISOString(),
              expires: new Date(Date.now() + 30 * 86400000).toISOString(),
              officer: user.name,
            }
          : { granted: false, at: new Date().toISOString() };
        audit(s, user, `${b.granted ? 'Recorded sharing consent' : 'Revoked sharing consent'} for ${m.id}`);
        save(s);
        return json(res, 200, m.consent);
      }
      if (match[2] === 'export' && req.method === 'GET') {
        requireRole(user, 'admin', 'supervisor');
        assert(
          m.consent?.granted && Date.parse(m.consent.expires) > Date.now(),
          'Current member consent is required before sharing',
          403
        );
        audit(s, user, `Exported ${m.id} for ${m.consent.recipient}`);
        save(s);
        return json(res, 200, {
          schema: 'fieldledger.profile.v1',
          issuer: s.settings.name,
          generatedAt: new Date().toISOString(),
          synthetic: demo,
          member: { id: m.id, name: m.name, business: m.business },
          indicators: indicators(m, s.visits, s.loans),
          reviewReasons: reviewReasons(m, s.visits, s.loans),
          consent: m.consent,
          notice:
            'Descriptive record only. Not a credit score, credit decision or cryptographically signed credential. Previously downloaded copies cannot be recalled.',
        });
      }
    }
    if (path === '/api/settings' && req.method === 'POST') {
      requireRole(user, 'admin');
      assert(str(b.name) && CURRENCIES.includes(b.currency) && str(b.country), 'Invalid organization settings');
      s.settings = {
        name: b.name.trim(),
        currency: b.currency,
        country: b.country.trim(),
        locale: LANGUAGES.find(l => l.code === s.config.language)?.locale || 'en',
      };
      audit(s, user, 'Updated organization settings (default currency applies to new records only)');
      save(s);
      return json(res, 200, s.settings);
    }
    throw new ApiError('Endpoint not found', 404);
  }
  return async function routeApi(req, res, url) {
    const b = ['GET', 'HEAD'].includes(req.method) ? {} : await parseBody(req),
      run = () => handle(req, res, url, b);
    if (['GET', 'HEAD'].includes(req.method)) return run();
    // Snapshot mutations must not interleave while certificate cryptography awaits.
    const operation = mutation.then(run);
    mutation = operation.catch(() => {});
    return operation;
  };
}
