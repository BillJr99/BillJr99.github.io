---
title: 'Giving Every Student Their Own VM: Jetstream2 Classroom Provisioning with OpenStack'
date: 2026-10-19
permalink: /posts/2026/10/jetstream2-classroom-vms/
tags:
 - ai
 - agentic
 - jetstream2
 - openstack
 - teaching
 - opencode
 - docker
---

This term, every student in my class has their own Linux VM on [Jetstream2](https://jetstream-cloud.org/), an NSF-funded research cloud available through the ACCESS program. Educational use is free. I use the VMs to run agentic coding tools such as OpenCode inside Docker, so students do not have to install anything on their laptops and I do not pay for cloud machines myself.

This post covers how I got an account, requested an allocation, exchanged credits for compute, and obtained the OpenStack credentials. It then shows the commands behind my provisioning script: creating a machine with my key, adding a student's key, and installing OpenCode. I have left out the full script. Every command below works for one machine, and a loop runs it for the whole class.

## Create an ACCESS account

Jetstream2 sign-in goes through [ACCESS](https://account.access-ci.org/). Register there, preferably with your institutional identity, and note your ACCESS username. The allocation request asks for it, and support tickets use your `@access-ci.org` identity.

## Request an allocation

Sign in at [allocations.access-ci.org](https://allocations.access-ci.org/) and start a new request. For a class, choose the **Explore** tier and the **Classroom / Training** grant type. Explore decisions usually arrive within about two business days, while larger tiers can take weeks.

The request asks for the following:

- A title and public overview describing the course and what students do on the VMs
- Fields of science (I chose Computer Science as primary and AI as secondary)
- Credits (the initial Explore award is 200,000, and you can request more later with a progress report)
- Personnel (I listed myself as both PI and Allocation Manager)
- A syllabus and a short CV

An Explore project lasts 12 months. Unspent credits expire when it ends.

## Exchange credits for Jetstream2 time

I did not expect this step. An approved allocation holds generic ACCESS credits, not Jetstream2 time, so you must exchange them for a specific resource before you can launch anything.

Open the approved project and go to **Credits + Resources**. Choose **Add a resource to your exchange** and select **Indiana Jetstream2 CPU**. On Jetstream2, one ACCESS credit equals one service unit (SU). I sized my request with this formula:

```
SUs = (number of VMs) x (SUs per hour) x 24 x (days remaining) x 1.10
```

My VMs use the `m3.quad` flavor, which has 4 vCPUs, 15 GB of RAM, and costs 4 SUs per hour. The 1.10 is a 10% cushion. The exchange also asks for a short justification. Describing the class, the VM size, and the software students run was enough. The resource provider then approves the exchange.

Four budgeting facts matter:

- A running VM uses 100% of its rate, whether or not anyone is logged in.
- A stopped VM still uses 50%.
- A shelved VM uses no compute SUs, so shelve a VM when you want to pause it.
- Hosted LLM inference uses no SUs, so you need GPU time only if students serve their own models.

## Get the credentials: `openrc.sh` and `clouds.yaml`

First add the allocation in [Exosphere](https://jetstream2.exosphere.app/) so you can see it. The command line needs an **application credential tied to the allocation**, which you create in Horizon. Do not use the "OpenStack RC File" option in Horizon's user menu, because Jetstream2 documents that it does not work.

1. Sign in to [Horizon](https://js2.jetstream-cloud.org/project/) with ACCESS CILogon.
2. Use the project selector at the top left to choose the allocation that holds your CPU exchange. This is easy to miss.
3. Open **Identity → Application Credentials** and click **Create Application Credential**.
4. Enter a descriptive name, a strong secret, and an **explicit expiration date** after the term ends. A blank expiration defaults to today, and authentication then fails tomorrow.
5. Download both files from the confirmation dialog: the openrc file (a shell script) and `clouds.yaml`. Horizon cannot show the secret again, so if you lose the files, create a new credential.

Store both files where only you can read them:

```bash
chmod 600 ~/jetstream/openrc-myproject.sh

mkdir -p ~/.config/openstack
mv ~/Downloads/clouds.yaml ~/.config/openstack/clouds.yaml
chmod 600 ~/.config/openstack/clouds.yaml
```

Both files contain the credential secret, so treat them like passwords. Keep them on your admin machine. Never put them in a git repository or on a student VM.

Use one file or the other, not both. To use the openrc file, **source** it. Running it as `./openrc.sh` sets the variables in a child process that exits immediately, which is the most common mistake:

```bash
source ~/jetstream/openrc-myproject.sh
```

To use `clouds.yaml`, name the cloud with the top-level key from your downloaded file:

```bash
export OS_CLOUD=openstack
```

Open a fresh terminal when you switch between the two. Then install the client and confirm that you are authenticated:

```bash
sudo apt install -y python3-openstackclient openssh-client

openstack token issue >/dev/null && echo "authenticated"
openstack flavor list                  # should list m3.* flavors
openstack image list | grep -i ubuntu  # find the exact image name
```

## Check your quotas

Each VM boots from its own volume and, in my setup, gets its own public floating IP. A new project's default quotas may be lower than your class size:

```bash
openstack quota show --usage
```

My instance quota was sufficient, but the volume and floating IP quotas were each 10. That would have stopped provisioning partway through a class of 22. To raise a quota, open an ACCESS help desk ticket with Issue set to *Allocation Question*, Resource set to *Jetstream2*, and Keyword set to *Quota*. Give the exact numbers you need and the reason. If a script stops at a quota limit, rerun it after the increase and it resumes where it stopped.

## Provision one machine

My script wraps the OpenStack commands below and adds a preview mode, a CSV of results, and safe reruns. Here are the commands underneath it.

### Create a VM with your key

Register your public key as an OpenStack keypair. At first boot, cloud-init installs it for the `ubuntu` user:

```bash
openstack keypair create --public-key ~/.ssh/id_rsa.pub class-admin-key

openstack server create vm01 \
  --flavor m3.quad \
  --image Featured-Ubuntu24 \
  --boot-from-volume 40 \
  --key-name class-admin-key \
  --security-group class-ssh \
  --network auto_allocated_network \
  --wait
```

The `class-ssh` security group allows inbound SSH on port 22. I also pass cloud-init user data that disables SSH password and keyboard-interactive login, so the VMs accept key logins only.

Next, give the VM a public address:

```bash
FIP=$(openstack floating ip create public -f value -c floating_ip_address)
openstack server add floating ip vm01 "$FIP"
```

### Trust the host key on first contact

Every SSH step below uses `StrictHostKeyChecking=accept-new`. This option records an unknown VM's host key on first contact and refuses to connect if the key later changes:

```bash
ssh -o StrictHostKeyChecking=accept-new -i ~/.ssh/id_rsa ubuntu@"$FIP" true
```

This is trust on first use, so the first connection is the one that matters. To verify a key independently, compare the fingerprints that cloud-init prints to the console log with the fingerprint you recorded locally:

```bash
openstack console log show vm01 \
  | sed -n '/BEGIN SSH HOST KEY FINGERPRINTS/,/END SSH HOST KEY FINGERPRINTS/p'
ssh-keygen -lF "$FIP"
```

Jetstream2 may give a new VM a floating IP that an older VM used, for example after you delete and rebuild the class. SSH then stops with `REMOTE HOST IDENTIFICATION HAS CHANGED`. That refusal is correct. Confirm that you rebuilt the VM, remove the stale entry with `ssh-keygen -R "$FIP"`, and connect again. A `Host` block in `~/.ssh/config` does not change this behavior, because OpenSSH uses the first value it finds for each option and the command-line option wins.

### Add a student's key

Each student generates a key pair on their own computer and sends me only the `.pub` file:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/class_vm   # the student runs this
```

I append that public key to the `ubuntu` account's `authorized_keys` on the student's VM, next to my own. Only the public key travels:

```bash
ssh -o StrictHostKeyChecking=accept-new -i ~/.ssh/id_rsa ubuntu@"$FIP" \
  'cat >> ~/.ssh/authorized_keys' < student-keys/alice.pub
```

The real script first checks whether the key is already present, so running it twice adds nothing. Afterward, the student and I both log in as `ubuntu`. The student can reach only their own VM, and I can reach all of them.

### Install Docker and OpenCode

This step installs Docker, adds `ubuntu` to the `docker` group, and pulls the OpenCode image:

```bash
ssh -o StrictHostKeyChecking=accept-new -i ~/.ssh/id_rsa ubuntu@"$FIP" '
  sudo apt-get update &&
  sudo apt-get install -y docker.io &&
  sudo usermod -aG docker ubuntu &&
  sudo docker pull ghcr.io/anomalyco/opencode:latest
'
```

A small launcher script in `/usr/local/bin/opencode` runs the container interactively. It mounts a directory in the student's home as the container's home, and it mounts OpenCode's config and data directories inside that. If a nested mountpoint does not exist, Docker creates it as `root`, and OpenCode, which runs as `ubuntu`, then fails with `EACCES: permission denied, mkdir '/opencode-home/.local/state'`. The launcher avoids this by creating every mountpoint as the invoking user before it starts the container:

```bash
mkdir -p ~/.opencode-container-home \
         ~/.config/opencode ~/.local/share/opencode

docker run -it --rm -u "$(id -u):$(id -g)" \
  -v ~/.opencode-container-home:/opencode-home \
  -v ~/.config/opencode:/opencode-home/.config/opencode \
  -v ~/.local/share/opencode:/opencode-home/.local/share/opencode \
  -v "$PWD":/workspace -w /workspace \
  ghcr.io/anomalyco/opencode:latest
```

The VMs also get [herdr](https://herdr.dev/), a terminal multiplexer for coding agents. Its sidebar shows whether each agent is working, blocked, or idle. I install it with herdr's official installer, which verifies the release checksum, and then register its OpenCode integration as the `ubuntu` user:

```bash
curl -fsSL https://herdr.dev/install.sh | sudo sh   # check herdr.dev for the current installer URL
herdr integration install opencode
```

The integration writes herdr's OpenCode plugin files into `~/.config/opencode`. The launcher already mounts that directory into the container, so OpenCode loads the plugin. The plugin reports to herdr only when `HERDR_ENV`, `HERDR_SOCKET_PATH`, and `HERDR_PANE_ID` are set and the herdr socket is reachable. When a student starts `opencode` inside a herdr pane, the launcher forwards those variables and mounts the socket's directory (normally `~/.config/herdr`) at the same path. Outside herdr, the launcher passes nothing extra.

The launcher excerpt above is simplified. Since the image uses the `:latest` tag, VMs set up at different times can end up with different OpenCode builds. Pin a tag or digest if every student needs the same version.

Students log out and back in once so the Docker group change takes effect. They then run `opencode` and use `/connect` to configure a model provider. I put no model credentials on the VMs.

## Do it in a loop

None of these commands is specific to one machine, so the class is a loop. The script generates the names and pairs them with the sorted list of student key files:

```bash
for i in $(seq -w 1 22); do
  openstack server create "vm$i" \
    --flavor m3.quad --image Featured-Ubuntu24 \
    --boot-from-volume 40 --key-name class-admin-key \
    --security-group class-ssh --network auto_allocated_network --wait
  # then: floating IP, student key $i, Docker and OpenCode
done
```

For each stage, I preview first, then run on one VM, then run on all of them.

## Lessons learned

- **Do not add students to the allocation.** Every member of an allocation can manage and delete everyone else's resources. Provision the VMs yourself and give each student SSH access to their own machine only.
- **The shared `ubuntu` account has passwordless `sudo` and Docker access, which is effectively root.** This is acceptable because each VM belongs to one student. A student could still remove my key, and the instance console in Horizon is the recovery path.
- **Set the credential expiration deliberately.** A credential that expires the same day produces the most confusing failure.
- **Stale or unsourced credentials produce errors such as `Missing value auth-url required for auth plugin password`.** Open a fresh terminal, source the right file, and do not run it under `sudo`.
- **At the end of the term, collect student work first.** Then shelve the VMs to stop charges, or delete them along with their volumes and floating IPs. Let the application credential expire, or delete it in Horizon, and file the allocation's final report.

The student key files, and any CSV that maps students to VMs and addresses, are student data. Keep them out of any public repository.
