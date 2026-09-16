CLUSTER := mini-ise
NAMESPACE := mini-ise
# Always target the kind cluster explicitly so these commands can never touch another cluster.
KUBECTL := kubectl --context kind-$(CLUSTER)
BACKEND_IMAGE := mini-ise-backend:dev
CONSOLE_IMAGE := mini-ise-console:dev
METRICS_SERVER_VERSION := v0.9.0
DEPLOYMENTS := policy-api decision-service console simulator

.PHONY: up cluster images metrics-server secret deploy status load-high load-normal kill-decision-pod down test

## Bring everything up from scratch: cluster, images, metrics, secret, workloads.
up: cluster images metrics-server secret deploy status

cluster:
	@kind get clusters 2>/dev/null | grep -qx '$(CLUSTER)' || kind create cluster --config k8s/kind/cluster.yaml

## Build both images and copy them into the kind nodes (no registry needed).
images:
	docker build -t $(BACKEND_IMAGE) backend
	docker build -t $(CONSOLE_IMAGE) frontend
	kind load docker-image $(BACKEND_IMAGE) $(CONSOLE_IMAGE) --name $(CLUSTER)

## metrics-server feeds CPU numbers to the autoscaler. kind kubelets use self-signed certs.
metrics-server:
	$(KUBECTL) apply -f https://github.com/kubernetes-sigs/metrics-server/releases/download/$(METRICS_SERVER_VERSION)/components.yaml
	@$(KUBECTL) -n kube-system get deployment metrics-server -o jsonpath='{.spec.template.spec.containers[0].args}' \
		| grep -q kubelet-insecure-tls \
		|| $(KUBECTL) -n kube-system patch deployment metrics-server --type=json \
			-p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

## Store the Anthropic key as a Kubernetes Secret, from the environment or .env. The key goes through stdin.
secret:
	@$(KUBECTL) apply -f k8s/00-namespace.yaml >/dev/null
	@key="$${ANTHROPIC_API_KEY:-$$(grep -E '^ANTHROPIC_API_KEY=' .env 2>/dev/null | cut -d= -f2-)}"; \
	printf '%s' "$$key" | $(KUBECTL) -n $(NAMESPACE) create secret generic anthropic \
		--from-file=ANTHROPIC_API_KEY=/dev/stdin --dry-run=client -o yaml | $(KUBECTL) apply -f - >/dev/null; \
	if [ -n "$$key" ]; then echo "anthropic secret: set"; else echo "anthropic secret: empty, AI drafting will be off"; fi

## Apply manifests, restart so rebuilt :dev images are picked up, and wait until healthy.
deploy:
	$(KUBECTL) apply -f k8s/
	$(KUBECTL) -n $(NAMESPACE) rollout restart deployment $(DEPLOYMENTS)
	@for d in $(DEPLOYMENTS); do $(KUBECTL) -n $(NAMESPACE) rollout status deployment/$$d --timeout=180s || exit 1; done

status:
	$(KUBECTL) -n $(NAMESPACE) get pods -o wide
	$(KUBECTL) -n $(NAMESPACE) get hpa

## Demo: push load so the autoscaler adds decision-service pods, then return to normal.
load-high:
	$(KUBECTL) -n $(NAMESPACE) set env deployment/simulator RPS=600

load-normal:
	$(KUBECTL) -n $(NAMESPACE) set env deployment/simulator RPS=20

## Demo: delete one decision-service pod and watch Kubernetes replace it.
kill-decision-pod:
	$(KUBECTL) -n $(NAMESPACE) delete $$($(KUBECTL) -n $(NAMESPACE) get pods -l app=decision-service -o name | head -1) --wait=false

down:
	kind delete cluster --name $(CLUSTER)

test:
	cd backend && uv run pytest -q
